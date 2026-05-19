import { NextResponse } from 'next/server';
import { verifyDatabaseConnection } from '../../../../src/lib/db';

export async function GET() {
  const health = await verifyDatabaseConnection();

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503
  });
}
