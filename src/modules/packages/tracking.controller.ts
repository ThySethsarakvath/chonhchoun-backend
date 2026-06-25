import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { PackagesService } from './packages.service';

/**
 * Public tracking controller — NO class-level JwtAuthGuard.
 *
 * Exposes two public routes:
 *  1. GET /track         → serves the HTML tracking page (excluded from api/v1 prefix)
 *  2. GET /packages/track/:trackingNumber → public JSON tracking API (no auth)
 *
 * The /track path is also excluded from the global prefix so it is
 * accessible at http://your-server/track (not http://your-server/api/v1/track).
 */
@Controller()
export class TrackingController {
  constructor(private readonly packagesService: PackagesService) {}

  /**
   * GET /track — serves the HTML tracking page.
   * Excluded from the api/v1 global prefix via main.ts setGlobalPrefix exclude list.
   */
  @Get('track')
  serveTrackingPage(@Res() res: Response) {
    res.sendFile(join(process.cwd(), 'public', 'track.html'));
  }

  /**
   * GET /api/v1/packages/track/:trackingNumber
   * Public JSON endpoint for tracking data — no auth required.
   * Called by the HTML tracking page via XHR (also usable by any public client).
   */
  @Get('packages/track/:trackingNumber')
  trackPackage(@Param('trackingNumber') trackingNumber: string) {
    return this.packagesService.findByTrackingNumber(trackingNumber);
  }
}


