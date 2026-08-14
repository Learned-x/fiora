-- Allinea la migration history allo stato TimescaleDB del DB: sensor_readings
-- era gia' una hypertable su dev (creata a mano, fuori da Prisma, mai tracciata
-- in migration history -- causava "drift detected" su ogni `prisma migrate dev`
-- per l'indice che create_hypertable genera automaticamente,
-- sensor_readings_time_idx). Non e' noto con certezza se anche staging sia
-- gia' stato convertito allo stesso modo (da verificare quando si e' sul
-- server) -- percio' i comandi sotto sono idempotenti (if_not_exists => true):
-- no-op dove la hypertable/policy esiste gia', altrimenti la creano davvero.
--
-- Verificato sul DB dev (2026-08-14):
--   SELECT * FROM timescaledb_information.hypertables;
--     -> sensor_readings e' gia' una hypertable (3 chunk, dimensione 'time')
--   SELECT * FROM timescaledb_information.jobs WHERE proc_name='policy_retention';
--     -> retention policy attiva, drop_after 90 giorni

SELECT create_hypertable('sensor_readings', 'time', migrate_data => true, if_not_exists => true);
SELECT add_retention_policy('sensor_readings', INTERVAL '90 days', if_not_exists => true);
