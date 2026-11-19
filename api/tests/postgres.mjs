import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'
import pg from 'pg'

const require = createRequire(import.meta.url)

function command(binary) {
	if (process.env.PG_BIN)
		return join(process.env.PG_BIN, binary + (process.platform === 'win32' ? '.exe' : ''))
	return binary
}

function run(binary, args, options = {}) {
	const result = spawnSync(binary, args, { encoding: 'utf8', windowsHide: true, ...options })
	if (result.error) throw result.error
	if (result.status !== 0) throw new Error(result.stdout + result.stderr)
	return result
}

export async function startPostgres() {
	const prefix = join(tmpdir(), 'teamdrop-auth-')
	const directory = mkdtempSync(prefix)
	let server
	let pool
	async function stop() {
		if (pool) await pool.end()
		if (server && server.exitCode === null) {
			const exited = new Promise((done) => server.once('exit', done))
			if (process.platform === 'win32') {
				spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
					windowsHide: true,
					stdio: 'ignore',
				})
			} else server.kill('SIGINT')
			await exited
		}
		// Only remove the explicitly allocated temporary test cluster.
		const target = resolve(directory)
		if (target.startsWith(resolve(prefix)) && target.startsWith(resolve(tmpdir()) + sep)) {
			rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
		}
	}
	try {
		run(command('initdb'), [
			'-D',
			directory,
			'-U',
			'teamdrop_auth_test',
			'-A',
			'trust',
			'-E',
			'UTF8',
			'--no-locale',
		])
		const socket = createServer()
		await new Promise((done, fail) => {
			socket.once('error', fail)
			socket.listen(0, '127.0.0.1', done)
		})
		const port = socket.address().port
		await new Promise((done) => socket.close(done))
		server = spawn(
			command('postgres'),
			['-D', directory, '-h', '127.0.0.1', '-p', String(port), '-F'],
			{
				windowsHide: true,
				stdio: 'ignore',
			},
		)
		let startupError
		server.once('error', (error) => {
			startupError = error
		})
		const url = `postgresql://teamdrop_auth_test@127.0.0.1:${port}/postgres`
		pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 500 })
		pool.on('error', () => {})
		let ready = false
		for (let tries = 0; tries < 100; tries++) {
			if (startupError) throw startupError
			if (server.exitCode !== null) throw new Error('Temporary PostgreSQL failed to start')
			try {
				await pool.query('SELECT 1')
				ready = true
				break
			} catch {
				await pause(100)
			}
		}
		if (!ready) throw new Error('Temporary PostgreSQL did not become ready')
		const env = { ...process.env, DATABASE_URL: url }
		const cli = require.resolve('prisma/build/index.js')
		run(process.execPath, [cli, 'migrate', 'deploy', '--config', 'prisma7.config.ts'], { env })
		run(
			process.execPath,
			[
				cli,
				'migrate',
				'diff',
				'--from-config-datasource',
				'--to-schema',
				'prisma/schema.prisma',
				'--exit-code',
				'--config',
				'prisma7.config.ts',
			],
			{ env },
		)
		return { url, stop }
	} catch (error) {
		await stop()
		throw error
	}
}
