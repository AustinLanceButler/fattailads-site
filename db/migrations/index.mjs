// db/migrations/index.mjs — ordered list of warehouse migrations. Append only.
import * as m0001 from './0001_ads.mjs';
import * as m0002 from './0002_media_daily.mjs';

export const MIGRATIONS = [m0001, m0002];
