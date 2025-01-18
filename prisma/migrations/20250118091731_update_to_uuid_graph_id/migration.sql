/*
  Warnings:

  - The primary key for the `Graph` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE `Edge` DROP FOREIGN KEY `Edge_graphId_fkey`;

-- DropForeignKey
ALTER TABLE `Step` DROP FOREIGN KEY `Step_graphId_fkey`;

-- DropIndex
DROP INDEX `Edge_graphId_fkey` ON `Edge`;

-- DropIndex
DROP INDEX `Step_graphId_fkey` ON `Step`;

-- AlterTable
ALTER TABLE `Edge` MODIFY `graphId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Graph` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `Step` MODIFY `graphId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `Step` ADD CONSTRAINT `Step_graphId_fkey` FOREIGN KEY (`graphId`) REFERENCES `Graph`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edge` ADD CONSTRAINT `Edge_graphId_fkey` FOREIGN KEY (`graphId`) REFERENCES `Graph`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
