import { Body, Controller, Post, } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service.js";
import { GoogleOAuthService } from "./oauth/google-oauth.service.js";

@Controller('api/auth')
export class AuthController {
    constructor(private googleOAuth: GoogleOAuthService, private prisma: PrismaService) {}

    @Post('google')
    async authenticateWithGoogle(
        @Body()
		body: any
    ) {
        const { code } = body

        const googleUserData = await this.googleOAuth.authenticate({
            code
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
    }
}