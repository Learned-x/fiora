-- DropIndex
DROP INDEX "sensor_readings_time_idx";

-- AlterTable
ALTER TABLE "smart_vases" ADD COLUMN     "ordine" INTEGER NOT NULL DEFAULT 0;
