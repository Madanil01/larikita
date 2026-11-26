import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';
import { appUrl } from '@/lib/strava';

export async function POST() {
  destroySession();
  return NextResponse.redirect(`${appUrl()}/`, { status: 303 });
}
