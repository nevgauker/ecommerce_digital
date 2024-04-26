/*
  Warnings:

  - The values [PRECENTAGE] on the enum `DiscountCodeType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DiscountCodeType_new" AS ENUM ('PERCENTAGE', 'FIXED');
ALTER TABLE "DiscountCode" ALTER COLUMN "discountCodeType" TYPE "DiscountCodeType_new" USING ("discountCodeType"::text::"DiscountCodeType_new");
ALTER TYPE "DiscountCodeType" RENAME TO "DiscountCodeType_old";
ALTER TYPE "DiscountCodeType_new" RENAME TO "DiscountCodeType";
DROP TYPE "DiscountCodeType_old";
COMMIT;
