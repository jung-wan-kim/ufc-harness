import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: siteUrl('/leaderboard'), lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: siteUrl('/auth/login'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: siteUrl('/submit'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
  ];
}
