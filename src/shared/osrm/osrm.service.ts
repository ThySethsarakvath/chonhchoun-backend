import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface OsrmRouteDetails {
  points: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
}

interface OsrmTableResponse {
  code: string;
  message?: string;
  durations: Array<Array<number | null>>;
}

interface OsrmEncodedRouteResponse {
  code: string;
  routes?: Array<{
    geometry: string;
    distance: number;
    duration: number;
  }>;
}

interface OsrmGeoJsonRouteResponse {
  code: string;
  routes?: Array<{
    geometry: {
      type: 'LineString';
      coordinates: Array<[number, number]>;
    };
    distance: number;
    duration: number;
  }>;
}

@Injectable()
export class OsrmService {
  private readonly logger = new Logger(OsrmService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('osrm.url')!;
  }

  async getDistanceMatrix(coords: Coordinate[]): Promise<number[][]> {
    const coordStr = coords
      .map((coordinate) => `${coordinate.longitude},${coordinate.latitude}`)
      .join(';');
    const url = `${this.baseUrl}/table/v1/driving/${coordStr}?annotations=duration`;

    this.logger.log(`OSRM table request: ${coords.length} locations`);

    try {
      const { data } = await axios.get<OsrmTableResponse>(url, {
        timeout: 30_000,
      });
      if (data.code !== 'Ok') {
        throw new Error(`OSRM error: ${data.code} - ${data.message}`);
      }

      const matrix: number[][] = data.durations.map((row) =>
        row.map((duration: number | null) => {
          if (duration == null) {
            throw new Error('OSRM returned an unreachable branch pair.');
          }
          return Math.round(duration);
        }),
      );

      this.logger.log(
        `OSRM matrix received: ${matrix.length}x${matrix.length}`,
      );
      return matrix;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown OSRM error';
      this.logger.error(`OSRM table failed: ${message}`);
      throw new ServiceUnavailableException(
        'Routing service unavailable or one of the branches is unreachable.',
      );
    }
  }

  async getRouteGeometry(coords: Coordinate[]): Promise<string | null> {
    if (coords.length < 2) return null;

    const coordStr = coords
      .map((coordinate) => `${coordinate.longitude},${coordinate.latitude}`)
      .join(';');
    const url = `${this.baseUrl}/route/v1/driving/${coordStr}?overview=full&geometries=polyline`;

    try {
      const { data } = await axios.get<OsrmEncodedRouteResponse>(url, {
        timeout: 15_000,
      });
      if (data.code !== 'Ok' || !data.routes?.[0]) return null;
      return data.routes[0].geometry;
    } catch {
      return null;
    }
  }

  async getRouteDetails(
    coords: Coordinate[],
  ): Promise<OsrmRouteDetails | null> {
    if (coords.length < 2) return null;

    const coordStr = coords
      .map((coordinate) => `${coordinate.longitude},${coordinate.latitude}`)
      .join(';');
    const url = `${this.baseUrl}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

    try {
      const { data } = await axios.get<OsrmGeoJsonRouteResponse>(url, {
        timeout: 15_000,
      });
      if (data.code !== 'Ok' || !data.routes?.[0]) return null;

      const route = data.routes[0];
      const points = route.geometry.coordinates
        .map(([longitude, latitude]) => ({ latitude, longitude }))
        .filter((point) => this.isValidCoordinate(point));
      if (points.length < 2) return null;

      return {
        points,
        distanceMeters: Math.round(route.distance ?? 0),
        durationSeconds: Math.round(route.duration ?? 0),
      };
    } catch {
      return null;
    }
  }

  private isValidCoordinate(coordinate: Coordinate): boolean {
    return (
      Number.isFinite(coordinate.latitude) &&
      Number.isFinite(coordinate.longitude) &&
      coordinate.latitude >= -90 &&
      coordinate.latitude <= 90 &&
      coordinate.longitude >= -180 &&
      coordinate.longitude <= 180
    );
  }
}
