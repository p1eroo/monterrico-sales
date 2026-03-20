-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "roleId" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'activo',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cargo" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "etapa" TEXT NOT NULL DEFAULT 'lead',
    "priority" TEXT NOT NULL DEFAULT 'media',
    "assignedTo" TEXT,
    "estimatedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nextAction" TEXT,
    "nextFollowUp" TIMESTAMP(3),
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "docType" TEXT,
    "docNumber" TEXT,
    "departamento" TEXT,
    "provincia" TEXT,
    "distrito" TEXT,
    "direccion" TEXT,
    "clienteRecuperado" TEXT,
    "etapaHistory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "razonSocial" TEXT,
    "ruc" TEXT,
    "domain" TEXT,
    "rubro" TEXT,
    "tipo" TEXT,
    "linkedin" TEXT,
    "correo" TEXT,
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "direccion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "etapa" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'abierta',
    "expectedCloseDate" TIMESTAMP(3),
    "assignedTo" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3),
    "startTime" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactContact" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "linkedId" TEXT NOT NULL,

    CONSTRAINT "ContactContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactOpportunity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,

    CONSTRAINT "ContactOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCompany" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "linkedId" TEXT NOT NULL,

    CONSTRAINT "CompanyCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyOpportunity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,

    CONSTRAINT "CompanyOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityOpportunity" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "linkedId" TEXT NOT NULL,

    CONSTRAINT "OpportunityOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactActivity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "ContactActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "CompanyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityActivity" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "OpportunityActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyContact_companyId_contactId_key" ON "CompanyContact"("companyId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactContact_contactId_linkedId_key" ON "ContactContact"("contactId", "linkedId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactOpportunity_contactId_opportunityId_key" ON "ContactOpportunity"("contactId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyCompany_companyId_linkedId_key" ON "CompanyCompany"("companyId", "linkedId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOpportunity_companyId_opportunityId_key" ON "CompanyOpportunity"("companyId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityOpportunity_opportunityId_linkedId_key" ON "OpportunityOpportunity"("opportunityId", "linkedId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactActivity_contactId_activityId_key" ON "ContactActivity"("contactId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyActivity_companyId_activityId_key" ON "CompanyActivity"("companyId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityActivity_opportunityId_activityId_key" ON "OpportunityActivity"("opportunityId", "activityId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactContact" ADD CONSTRAINT "ContactContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactContact" ADD CONSTRAINT "ContactContact_linkedId_fkey" FOREIGN KEY ("linkedId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactOpportunity" ADD CONSTRAINT "ContactOpportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactOpportunity" ADD CONSTRAINT "ContactOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCompany" ADD CONSTRAINT "CompanyCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCompany" ADD CONSTRAINT "CompanyCompany_linkedId_fkey" FOREIGN KEY ("linkedId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOpportunity" ADD CONSTRAINT "CompanyOpportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOpportunity" ADD CONSTRAINT "CompanyOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityOpportunity" ADD CONSTRAINT "OpportunityOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityOpportunity" ADD CONSTRAINT "OpportunityOpportunity_linkedId_fkey" FOREIGN KEY ("linkedId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyActivity" ADD CONSTRAINT "CompanyActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyActivity" ADD CONSTRAINT "CompanyActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
