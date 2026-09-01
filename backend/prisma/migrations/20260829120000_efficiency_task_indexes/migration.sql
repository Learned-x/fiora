-- CreateIndex
-- `IF NOT EXISTS` (aggiunto a mano al SQL generato da Prisma): questi due indici sono
-- già stati creati manualmente sul DB di staging durante l'analisi delle prestazioni,
-- con gli stessi nomi. Senza `IF NOT EXISTS` il `migrate deploy` fallirebbe lì.
CREATE INDEX IF NOT EXISTS "idx_tasks_plant_stato" ON "tasks"("plant_id", "stato");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_tasks_user_stato_scadenza" ON "tasks"("user_id", "stato", "scadenza");
