-- AddForeignKey
ALTER TABLE "Authority" ADD CONSTRAINT "Authority_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
