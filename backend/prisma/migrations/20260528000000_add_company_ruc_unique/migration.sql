-- AlterTable: add unique constraint on Company.ruc
CREATE UNIQUE INDEX "Company_ruc_key" ON "Company"("ruc");
