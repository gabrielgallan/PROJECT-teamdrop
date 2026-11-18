import { createHash, randomBytes } from "node:crypto";
import { Controller, Get, Query, Redirect, UnauthorizedException, } from "@nestjs/common";
import { CacheRepository } from "../cache/cache.interface.js";
import { PrismaService } from "../database/prisma/prisma.service.js";
import { GoogleOAuthService } from "./oauth/google-oauth.service.js";

@Controller('api/auth')
export class AuthController {
    constructor(private googleOAuth: GoogleOAuthService, private prisma: PrismaService, private cache: CacheRepository) {}

    @Get('google/start')
    @Redirect()
    async startGoogleOAuth() {
        const state = randomBytes(32).toString('base64url')
        const codeVerifier = randomBytes(32).toString('base64url')

        const codeChallenge = createHash('sha256')
            .update(codeVerifier)
            .digest('base64url')

        await this.cache.set(`auth:oauth:${state}`, JSON.stringify({ codeVerifier }), 300)

        return {
            url: this.googleOAuth.getAuthUrl(state, codeChallenge),
            statusCode: 302,
        }
    }

    @Get('google/callback')
    async authenticateWithGoogle(
        @Query('code') code: string,
        @Query('state') state: string,
    ) {
        const attempt = await this.cache.getDel(`auth:oauth:${state}`)

        if (!attempt) {
            throw new UnauthorizedException(
                'Invalid or expired OAuth state',
            )
        }

        const { codeVerifier } = JSON.parse(attempt)

        // Get user google account
        const googleUserData = await this.googleOAuth.authenticate({
            code,
            codeVerifier
        })    

        let user = await this.prisma.user.findUnique({
            where: {
                email: googleUserData.email
            }
        })

        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    name: googleUserData.name,
                    email: googleUserData.email,
                    avatarUrl: googleUserData.avatarUrl,
                }
            })
        }

        const account = await this.prisma.account.findUnique({
            where: {
                provider_userId: {
                    userId: user.id,
                    provider: 'GOOGLE'
                }
            }
        })

        if (!account) {
            await this.prisma.account.create({
                data: {
                    userId: user.id,
                    provider: 'GOOGLE',
                    providerAccountId: googleUserData.id
                }
            })
        }

        return {
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        }
    }
}