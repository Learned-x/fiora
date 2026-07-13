-- DropForeignKey
ALTER TABLE "species" DROP CONSTRAINT "species_trefle_id_fkey";

-- DropIndex
DROP INDEX "species_trefle_id_key";

-- AlterTable
ALTER TABLE "species" DROP COLUMN "trefle_id",
ADD COLUMN     "external_id" INTEGER;

-- DropTable
DROP TABLE "trefle_species_raw";

-- CreateTable
CREATE TABLE "species_import_raw" (
    "external_id" INTEGER NOT NULL,
    "fonte" VARCHAR(50) NOT NULL DEFAULT 'csv',
    "slug" TEXT NOT NULL,
    "scientific_name" TEXT NOT NULL,
    "common_name" TEXT,
    "family" TEXT,
    "family_common_name" TEXT,
    "genus" TEXT,
    "rank" TEXT,
    "status" TEXT,
    "data" JSONB NOT NULL,
    "updated_at_source" TIMESTAMPTZ,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "species_import_raw_pkey" PRIMARY KEY ("external_id")
);

-- CreateIndex
CREATE INDEX "idx_species_import_raw_scientific_name" ON "species_import_raw"("scientific_name");

-- CreateIndex
CREATE INDEX "idx_species_import_raw_common_name" ON "species_import_raw"("common_name");

-- CreateIndex
CREATE INDEX "idx_species_import_raw_family" ON "species_import_raw"("family");

-- CreateIndex
CREATE UNIQUE INDEX "species_external_id_key" ON "species"("external_id");

-- AddForeignKey
ALTER TABLE "species" ADD CONSTRAINT "species_external_id_fkey" FOREIGN KEY ("external_id") REFERENCES "species_import_raw"("external_id") ON DELETE SET NULL ON UPDATE CASCADE;

