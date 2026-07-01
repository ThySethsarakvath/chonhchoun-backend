import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

@Injectable()
export class OsrmService {
  private readonly logger = new Logger(OsrmService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('osrm.url')!;
  }

  /**
   * Build an N×N travel-time matrix (in seconds) from OSRM Table API.
   * coords[0] = depot, coords[1..N] = destination warehouses.
   */
  async getDistanceMatrix(coords: Coordinate[]): Promise<number[][]> {
    // OSRM expects coords as "lng,lat;lng,lat;..."
    const coordStr = coords
      .map(c => `${c.longitude},${c.latitude}`)
      .join(';');

    const url = `${this.baseUrl}/table/v1/driving/${coordStr}?annotations=duration`;

    this.logger.log(`OSRM table request: ${coords.length} locations`);

    try {
      const { data } = await axios.get(url, { timeout: 30_000 });

      if (data.code !== 'Ok') {
        throw new Error(`OSRM error: ${data.code} — ${data.message}`);
      }

      // duration matrix is in seconds (floats) — round to integers for OR-Tools
      const matrix: number[][] = data.durations.map((row: number[]) =>
        row.map((v: number) => Math.round(v)),
      );

      this.logger.log(`OSRM matrix received: ${matrix.length}×${matrix.length}`);
      return matrix;
    } catch (err: any) {
      this.logger.error(`OSRM table failed: ${err.message}`);
      throw new ServiceUnavailableException(
        'Routing service unavailable. Is OSRM running?',
      );
    }
  }

  /**
   * Get the route geometry (encoded polyline) for a sequence of coordinates.
   * Used after VRP solve to store turn-by-turn geometry per driver.
   */
  async getRouteGeometry(coords: Coordinate[]): Promise<string | null> {
    if (coords.length < 2) return null;

    const coordStr = coords.map(c => `${c.longitude},${c.latitude}`).join(';');
    const url = `${this.baseUrl}/route/v1/driving/${coordStr}?overview=full&geometries=polyline`;

    try {
      const { data } = await axios.get(url, { timeout: 15_000 });
      if (data.code !== 'Ok' || !data.routes?.[0]) return null;
      return data.routes[0].geometry; // encoded polyline string
    } catch {
      return null; // non-fatal — geometry is optional
    }
  }
}