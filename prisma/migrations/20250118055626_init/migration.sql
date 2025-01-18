-- CreateTable
CREATE TABLE `Graph` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Step` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `graphId` INTEGER NOT NULL,
    `nodeName` VARCHAR(191) NOT NULL,
    `stepIndex` INTEGER NOT NULL,
    `inputJson` VARCHAR(191) NOT NULL,
    `outputJson` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Edge` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `graphId` INTEGER NOT NULL,
    `sourceNode` VARCHAR(191) NOT NULL,
    `targetNode` VARCHAR(191) NOT NULL,
    `conditionKey` VARCHAR(191) NULL,
    `usedCount` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Step` ADD CONSTRAINT `Step_graphId_fkey` FOREIGN KEY (`graphId`) REFERENCES `Graph`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edge` ADD CONSTRAINT `Edge_graphId_fkey` FOREIGN KEY (`graphId`) REFERENCES `Graph`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
