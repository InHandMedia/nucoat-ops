// Emails the owner the weekly digest every Monday morning.
// Netlify schedules run in UTC: 13:00 UTC is 8 AM Eastern in winter and 9 AM in summer.
import { sendDigest } from '../lib/digest.mjs';

export default async () => {
  const result = await sendDigest();
  console.log('weekly digest:', result.message);
};

export const config = { schedule: '0 13 * * 1' };
