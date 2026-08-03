-- CreateTable
CREATE TABLE "ContactoClienteActivity" (
    "id" TEXT NOT NULL,
    "contactoClienteId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "ContactoClienteActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactoClienteActivity_contactoClienteId_activityId_key" ON "ContactoClienteActivity"("contactoClienteId", "activityId");

-- CreateIndex
CREATE INDEX "ContactoClienteActivity_contactoClienteId_idx" ON "ContactoClienteActivity"("contactoClienteId");

-- CreateIndex
CREATE INDEX "ContactoClienteActivity_activityId_idx" ON "ContactoClienteActivity"("activityId");

-- AddForeignKey
ALTER TABLE "ContactoClienteActivity" ADD CONSTRAINT "ContactoClienteActivity_contactoClienteId_fkey" FOREIGN KEY ("contactoClienteId") REFERENCES "ContactoCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoClienteActivity" ADD CONSTRAINT "ContactoClienteActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
