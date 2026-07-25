import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

@Injectable()
export class DriversService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private static readonly COMPLETED_STATUSES = [
    'delivered',
    'DELIVERED',
    'COMPLETED',
    'arrived_at_destination',
    'arrived_at_warehouse',
  ];

  private static readonly RATE_PER_DELIVERY = 1.5;

  private toObjectId(id: string): Types.ObjectId | null {
    return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
  }

  private decodePolyline(encoded: string): [number, number][] {
    if (!encoded) return [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coords: [number, number][] = [];
    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lat += result & 1 ? ~(result >> 1) : result >> 1;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lng += result & 1 ? ~(result >> 1) : result >> 1;
      coords.push([lat / 1e5, lng / 1e5]);
    }
    return coords;
  }

  private branchPoint(branch: any): { lat: number; lng: number } | null {
    if (!branch) return null;
    const lat = branch?.location?.lat ?? branch?.latitude;
    const lng = branch?.location?.lng ?? branch?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return { lat, lng };
  }

  async getMyEarnings(userId: string) {
    const uid = this.toObjectId(userId);
    const drivers = this.connection.collection('drivers');
    const packages = this.connection.collection('packages');

    const driver = uid
      ? await drivers.findOne({ userId: uid })
      : await drivers.findOne({ userId });

    const driverIdMatch = uid ? { $in: [uid, userId] } : (userId as any);
    const docs = await packages
      .find({ driverId: driverIdMatch as any })
      .toArray();

    const rate = DriversService.RATE_PER_DELIVERY;
    const completedSet = DriversService.COMPLETED_STATUSES;
    const isDone = (s: any) => completedSet.includes(String(s));

    let totalAssigned = 0;
    let completed = 0;
    for (const d of docs) {
      totalAssigned++;
      if (isDone(d.status)) completed++;
    }
    const activeAssigned = totalAssigned - completed;
    const totalEarnings = this.round2(completed * rate);

    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const days = [] as {
      day: string;
      amount: number;
      deliveries: number;
      key: string;
    }[];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      days.push({
        day: labels[dt.getDay()],
        amount: 0,
        deliveries: 0,
        key: dt.toISOString().slice(0, 10),
      });
    }
    const dayIndex = new Map(days.map((d, idx) => [d.key, idx]));

    for (const d of docs) {
      const key = this.packageTime(d).toISOString().slice(0, 10);
      const idx = dayIndex.get(key);
      if (idx !== undefined && isDone(d.status)) {
        days[idx].deliveries++;
        days[idx].amount = this.round2(days[idx].amount + rate);
      }
    }
    const weekly = days.map((d) => ({
      day: d.day,
      amount: d.amount,
      deliveries: d.deliveries,
    }));
    const weekTotal = this.round2(
      weekly.reduce((sum, d) => sum + d.amount, 0),
    );

    const sorted = [...docs].sort(
      (a, b) => this.packageTime(b).getTime() - this.packageTime(a).getTime(),
    );
    const transactions = sorted.slice(0, 8).map((d) => ({
      title: this.packageTitle(d),
      subtitle: this.packageSubtitle(d),
      amount: isDone(d.status) ? rate : 0,
      time: this.relativeTime(this.packageTime(d)),
      kind: 'delivery',
      isPayout: false,
    }));

    return {
      hasProfile: !!driver,
      currency: 'USD',
      availableBalance: totalEarnings,
      ratePerDelivery: rate,
      totalEarnings,
      weekTotal,
      completedDeliveries: completed,
      onlineSeconds: 0,
      rating: 0,
      activeAssigned,
      totalAssigned,
      vehicleType: driver?.vehicleType ?? null,
      vehiclePlate: driver?.vehiclePlate ?? null,
      status: driver?.status ?? null,
      weekly,
      transactions,
    };
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private packageTime(d: any): Date {
    const raw =
      d?.deliveredAt ?? d?.updatedAt ?? d?.createdAt ?? d?.created_at;
    const date = raw ? new Date(raw) : new Date();
    return isNaN(date.getTime()) ? new Date() : date;
  }

  private packageTitle(d: any): string {
    return String(d?.package?.name ?? d?.itemName ?? 'Delivery');
  }

  private packageSubtitle(d: any): string {
    const from = d?.pickup?.address;
    const to = d?.dropoff?.address;
    if (from && to) return `${from} → ${to}`;
    return String(d?.trackingNumber ?? '');
  }

  private relativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return date.toISOString().slice(0, 10);
  }

  async getMyProfile(userId: string) {
    const uid = this.toObjectId(userId);
    const drivers = this.connection.collection('drivers');
    const branches = this.connection.collection('branches');

    const driver = uid
      ? await drivers.findOne({ userId: uid })
      : await drivers.findOne({ userId });

    let branch: { name: string; lat: number | null; lng: number | null } | null =
      null;
    if (driver?.currentBranchId) {
      const b = await branches.findOne({ _id: driver.currentBranchId });
      if (b) {
        const point = this.branchPoint(b);
        branch = {
          name: String(b.name ?? 'Branch'),
          lat: point?.lat ?? null,
          lng: point?.lng ?? null,
        };
      }
    }

    return {
      hasProfile: !!driver,
      vehicleType: driver?.vehicleType ?? null,
      vehiclePlate: driver?.vehiclePlate ?? null,
      status: driver?.status ?? null,
      isActive: driver?.isActive ?? null,
      preferredZones: Array.isArray(driver?.preferredZones)
        ? (driver!.preferredZones as any[]).map((z) => String(z))
        : [],
      branch,
    };
  }

  async getMyRoute(userId: string) {
    const uid = this.toObjectId(userId);
    const drivers = this.connection.collection('drivers');
    const deliveries = this.connection.collection('deliveries');
    const branches = this.connection.collection('branches');

    const driver = uid
      ? await drivers.findOne({ userId: uid })
      : await drivers.findOne({ userId });
    const driverObjId = driver?._id as Types.ObjectId | undefined;

    let delivery = driverObjId
      ? await deliveries.findOne(
          { 'routes.driverId': driverObjId },
          { sort: { updatedAt: -1 } },
        )
      : null;

    let isSample = false;
    if (!delivery) {
      delivery = await deliveries.findOne(
        { 'routes.0': { $exists: true } },
        { sort: { updatedAt: -1 } },
      );
      isSample = true;
    }

    if (
      !delivery ||
      !Array.isArray(delivery.routes) ||
      !delivery.routes.length
    ) {
      return { hasRoute: false };
    }

    const route =
      (driverObjId &&
        delivery.routes.find(
          (r: any) => r?.driverId?.toString() === driverObjId.toString(),
        )) ||
      delivery.routes[0];

    const stops = Array.isArray(route.stops) ? route.stops : [];

    const branchIds = [
      delivery.sourceBranchId,
      ...stops.map((s: any) => s.branchId),
    ].filter(Boolean);
    const branchDocs = await branches
      .find({ _id: { $in: branchIds } })
      .toArray();
    const branchMap = new Map(
      branchDocs.map((b: any) => [b._id.toString(), b]),
    );

    const sourceBranch = branchMap.get(delivery.sourceBranchId?.toString());
    const source = this.branchPoint(sourceBranch);

    const resolvedStops = stops
      .sort((a: any, b: any) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0))
      .map((s: any) => {
        const branch = branchMap.get(s.branchId?.toString());
        const point = this.branchPoint(branch);
        return {
          order: Number(s.stopOrder ?? 0),
          branchName: branch?.name ?? 'Unknown stop',
          lat: point?.lat ?? null,
          lng: point?.lng ?? null,
          etaSeconds: Number(s.estimatedArrivalSeconds ?? 0),
          packageCount: Array.isArray(s.packageIds) ? s.packageIds.length : 0,
        };
      });

    const totalPackages =
      Number(delivery.totalPackages) ||
      resolvedStops.reduce((sum, s) => sum + s.packageCount, 0);

    return {
      hasRoute: true,
      isSample,
      deliveryId: delivery._id?.toString(),
      status: delivery.status ?? 'PLANNED',
      isCompleted: !!route.isCompleted,
      totalDurationSeconds: Number(route.totalDurationSeconds ?? 0),
      totalPackages,
      totalStops: resolvedStops.length,
      source: source
        ? {
            branchName: sourceBranch?.name ?? 'Origin',
            lat: source.lat,
            lng: source.lng,
          }
        : null,
      stops: resolvedStops,
      geometry: this.decodePolyline(route.routeGeometry ?? ''),
    };
  }
}
