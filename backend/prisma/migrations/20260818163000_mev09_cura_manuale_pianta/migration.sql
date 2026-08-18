-- Dati di cura (luce/annaffiatura/umidità) direttamente sulla pianta: unica
-- fonte per piante senza specie di catalogo, override opzionale per quelle
-- con specie. null = usa il default della specie collegata.
ALTER TABLE "plants" ADD COLUMN "luce_cura" VARCHAR(50);
ALTER TABLE "plants" ADD COLUMN "annaffiatura_cura" VARCHAR(50);
ALTER TABLE "plants" ADD COLUMN "umidita_cura" VARCHAR(50);
