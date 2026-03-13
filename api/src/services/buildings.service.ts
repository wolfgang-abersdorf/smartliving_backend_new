import { Prisma } from '@prisma/client';

export type BuildingWithRelations = Prisma.BuildingGetPayload<{
    include: {
        blocks: {
            include: {
                units: true;
            };
        };
    };
}>;

export function transformBuildingToWpFormat(building: BuildingWithRelations) {
    return {
        id: building.id,
        title: { rendered: building.title },  // WP compatibility format
        acf: {
            address: building.address,
            area: building.area,
            main_image: building.mainImageUrl,
            description: building.description,
            having_a_view: building.hasView,
            availability_of_a_swimming_pool: building.hasPool,
            car_access: building.hasCarAccess,
            private_parking: building.hasParking,
            developer: building.developer,
            commission: building.commission,
            telegram: building.telegram,
            whatsapp: building.whatsapp,
            pdf_file: building.pdfUrl,
            characteristics: {
                class_of_building: building.buildingClass,
                building_material: building.buildingMaterial,
                the_road_to_the_house: building.roadType,
                territory: building.territory,
            },
            advantages: building.advantages,
            contacts: building.contacts,
            documents: building.documents,
            album: building.albums,
            map: building.mapData,
            stamp_image: building.stampImageUrl,
            stamp_position: building.stampPosition,
            block: building.blocks.map(block => ({
                block_id: block.blockUid,
                title: block.title,
                category: block.category,
                completion_year: block.completionYear,
                completion_quarter: block.completionQuarter,
                construction_stage: block.constructionStage,
                type_of_ownership: block.typeOfOwnership,
                total_years_of_leasehold: block.leaseholdYears,
                units: {
                    unit: block.units.map(unit => ({
                        numbertitle: unit.numberTitle,
                        area_m2: unit.areaM2 ? String(unit.areaM2) : '',
                        price: unit.price ? String(unit.price) : '',
                        currency: unit.currency,
                        status: unit.status,
                        number_of_rooms: unit.rooms ? String(unit.rooms) : '',
                        floor: unit.floor != null ? String(unit.floor) : '',
                        amount_of_floors: unit.floorsTotal ? String(unit.floorsTotal) : '',
                        land_area: unit.landArea ? String(unit.landArea) : '',
                        type_of_apartment: unit.apartmentTypes || [],
                        having_a_view: unit.views || [],
                        property_type: unit.propertyType,
                        photo: unit.photos || [],
                    })),
                },
            })),
        },
        coordinates: building.lat && building.lng
            ? [{ lat: building.lat, lng: building.lng }]
            : [],
        lat: building.lat ? Number(building.lat) : 0,
        lng: building.lng ? Number(building.lng) : 0,
        main_image_thumbnail: {
            thumbnail: building.mainImageThumb || building.mainImageUrl,
            card: building.mainImageCard || building.mainImageUrl,
            full: building.mainImageUrl,
        },
    };
}
