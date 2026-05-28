-- AlterTable: remove docType and docNumber from Contact
ALTER TABLE "Contact" DROP COLUMN "docType",
                       DROP COLUMN "docNumber";
