import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from './guards/role.guard';
import { Roles } from './decorators/roles.decorators';
import { CurrentUser } from './decorators/current-user.decorator';
import { Role } from '../../common/enum/role.enum';

// NOTE: Registration is now handled by RegistrationController
// at POST /auth/register/initiate, /verify-email, /complete

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/v1/auth/driver-register (Bypass OTP for driver prototype)
  @Post('driver-register')
  @HttpCode(HttpStatus.OK)
  driverRegister(@Body() dto: any) {
    return this.authService.driverRegister(dto);
  }

  // POST /api/v1/auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // POST /api/v1/auth/refresh
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  refresh(@CurrentUser() user: any) {
    return this.authService.refresh(user.sub, user.refreshToken, user.jti);
  }

  // POST /api/v1/auth/logout
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: any) {
    return this.authService.logout(user._id.toString(), user.jti);
  }

  // GET /api/v1/auth/me
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user._id.toString());
  }

  // GET /api/v1/auth/admin-only
  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminOnly(@CurrentUser() user: any) {
    return { message: `Welcome admin ${user.name}!` };
  }

  // GET /api/v1/auth/driver
  @Get('driver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER)
  driverOnly(@CurrentUser() user: any) {
    return { message: `Welcome ${user.role}: ${user.name}` };
  }
}
