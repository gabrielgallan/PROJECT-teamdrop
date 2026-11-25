export class ApiError extends Error {
	constructor(public status: number, public code?: string) {
		super('Não foi possível concluir a solicitação.')
		this.name = 'ApiError'
	}
}

export function isCancelled(error: unknown) {
	return error instanceof Error && error.name === 'AbortError'
}

export function errorMessage(error: unknown): string {
	if (!error || isCancelled(error)) return ''
	if (error instanceof ApiError) {
		switch (error.status) {
			case 400: return 'Confira os dados e tente novamente.'
			case 401: return 'Sua sessão precisa ser renovada. Entre novamente se necessário.'
			case 403: return 'Você não tem permissão para esta ação.'
			case 404: return 'O recurso ou o acesso não está mais disponível. Atualize a lista.'
			case 409: return 'A operação conflita com o estado atual. Confira os dados e tente novamente.'
			case 410: return 'O convite expirou, foi revogado ou atingiu o limite de usos. Peça um novo link.'
			case 413: return 'O arquivo excede o tamanho aceito pelo servidor.'
			case 502:
			case 503: return 'O serviço está indisponível. Tente novamente.'
		}
	}
	if (error instanceof Error && error.name === 'TimeoutError') return 'A solicitação demorou demais. Tente novamente.'
	return 'Não foi possível concluir a operação. Verifique a conexão e tente novamente.'
}
