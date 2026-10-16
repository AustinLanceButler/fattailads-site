// db/migrations/index.mjs — ordered list of warehouse migrations. Append only.
import * as m0001 from './0001_ads.mjs';
import * as m0002 from './0002_media_daily.mjs';
import * as m0003 from './0003_tiktok.mjs';
import * as m0004 from './0004_conv_labels_all_conversions.mjs';

export const MIGRATIONS = [m0001, m0002, m0003, m0004];
