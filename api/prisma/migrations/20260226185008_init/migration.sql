-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone_number" TEXT,
    "company" TEXT,
    "position" TEXT,
    "client_mode" BOOLEAN DEFAULT false,
    "profile_photo" TEXT,
    "role" TEXT DEFAULT 'agent',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "area" TEXT,
    "description" TEXT,
    "developer" TEXT,
    "commission" TEXT,
    "telegram" TEXT,
    "whatsapp" TEXT,
    "has_view" BOOLEAN DEFAULT false,
    "has_pool" BOOLEAN DEFAULT false,
    "has_car_access" BOOLEAN DEFAULT false,
    "has_parking" BOOLEAN DEFAULT false,
    "main_image_url" TEXT,
    "main_image_thumb" TEXT,
    "main_image_card" TEXT,
    "pdf_url" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "building_class" TEXT,
    "building_material" TEXT,
    "road_type" TEXT,
    "territory" TEXT,
    "advantages" TEXT[],
    "contacts" JSONB DEFAULT '[]',
    "albums" JSONB DEFAULT '[]',
    "documents" JSONB DEFAULT '[]',
    "map_data" TEXT,
    "author_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" SERIAL NOT NULL,
    "block_uid" TEXT NOT NULL,
    "building_id" INTEGER NOT NULL,
    "title" TEXT,
    "category" TEXT NOT NULL,
    "completion_year" INTEGER,
    "completion_quarter" TEXT,
    "construction_stage" TEXT,
    "type_of_ownership" TEXT,
    "leasehold_years" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" SERIAL NOT NULL,
    "block_id" INTEGER NOT NULL,
    "number_title" TEXT,
    "area_m2" DECIMAL(65,30),
    "price" DECIMAL(65,30),
    "currency" TEXT DEFAULT 'USD',
    "status" TEXT DEFAULT 'Sale',
    "rooms" INTEGER,
    "floor" INTEGER,
    "floors_total" INTEGER,
    "land_area" DECIMAL(65,30),
    "apartment_types" TEXT[],
    "views" TEXT[],
    "property_type" TEXT,
    "photos" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "objects" TEXT,
    "author_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_buildings" (
    "collection_id" INTEGER NOT NULL,
    "building_id" INTEGER NOT NULL,

    CONSTRAINT "collection_buildings_pkey" PRIMARY KEY ("collection_id","building_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_slug_key" ON "buildings"("slug");

-- CreateIndex
CREATE INDEX "buildings_area_idx" ON "buildings"("area");

-- CreateIndex
CREATE INDEX "buildings_author_id_idx" ON "buildings"("author_id");

-- CreateIndex
CREATE INDEX "buildings_slug_idx" ON "buildings"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_block_uid_key" ON "blocks"("block_uid");

-- CreateIndex
CREATE INDEX "blocks_building_id_idx" ON "blocks"("building_id");

-- CreateIndex
CREATE INDEX "blocks_category_idx" ON "blocks"("category");

-- CreateIndex
CREATE INDEX "blocks_type_of_ownership_idx" ON "blocks"("type_of_ownership");

-- CreateIndex
CREATE INDEX "blocks_construction_stage_idx" ON "blocks"("construction_stage");

-- CreateIndex
CREATE INDEX "units_block_id_idx" ON "units"("block_id");

-- CreateIndex
CREATE INDEX "units_status_idx" ON "units"("status");

-- CreateIndex
CREATE INDEX "units_price_idx" ON "units"("price");

-- CreateIndex
CREATE INDEX "units_area_m2_idx" ON "units"("area_m2");

-- CreateIndex
CREATE INDEX "units_rooms_idx" ON "units"("rooms");

-- CreateIndex
CREATE INDEX "collections_author_id_idx" ON "collections"("author_id");

-- CreateIndex
CREATE INDEX "collection_buildings_building_id_idx" ON "collection_buildings"("building_id");

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_buildings" ADD CONSTRAINT "collection_buildings_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_buildings" ADD CONSTRAINT "collection_buildings_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
