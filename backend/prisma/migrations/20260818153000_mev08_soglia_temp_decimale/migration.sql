-- Le soglie temperatura erano Int, ma SensorReading.temperatura ha un decimale
-- (Decimal(4,1)) — un utente non può impostare 18.5°C con una soglia intera.
ALTER TABLE "plants" ALTER COLUMN "soglia_temp_min" TYPE DECIMAL(4,1);
ALTER TABLE "plants" ALTER COLUMN "soglia_temp_max" TYPE DECIMAL(4,1);
