/*
  Warnings:

  - You are about to drop the column `discountCodeType` on the `DiscountCode` table. All the data in the column will be lost.
  - Added the required column `discountType` to the `DiscountCode` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DiscountCode" DROP COLUMN "discountCodeType",
ADD COLUMN     "discountType" "DiscountCodeType" NOT NULL;
