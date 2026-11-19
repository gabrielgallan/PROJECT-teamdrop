import { Controller, Get, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser, AuthService } from '../../auth/services/auth.service.js';
import { PublicUserDto } from './dtos/public-user.dto.js';

@ApiTags('Users')
@Controller('api/users')
export class UsersController {
    constructor(private authService: AuthService) {}

    @Get('profile')
    @HttpCode(200)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Get authenticated user profile',
    })
    @ApiResponse({
        status: 200,
        type: PublicUserDto
        })
    @ApiResponse({
        status: 401,
        description: 'INVALID_ACCESS_TOKEN, ACCESS_TOKEN_EXPIRED, or user no longer exists',
    })
    async getProfile(@CurrentUser() user: AuthenticatedUser) {
        return { user: await this.authService.getProfile(user.userId) }
    }
}
