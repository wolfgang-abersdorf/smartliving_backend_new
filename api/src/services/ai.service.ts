import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

interface AIResponse {
    message: string;
    suggestions?: string[];
    relatedBlocks?: any[];
    action?: {
        type: 'search' | 'filter' | 'create_collection' | 'navigate';
        payload: any;
    };
    debugFilters?: any;
}

const functionSchema = {
    name: "filter_properties",
    description: "Filters real estate properties based on user request",
    parameters: {
        type: "object",
        properties: {
            category: { type: "string", enum: ["apartments", "villas", "townhouses", "commercial space"] },
            areas: { type: "array", items: { type: "string" } },
            minPrice: { type: "number" },
            maxPrice: { type: "number" },
            minBedrooms: { type: "number" },
            maxBedrooms: { type: "number" },
            minArea: { type: "number" },
            maxArea: { type: "number" },
            completionStage: { type: "string", enum: ["Ready", "Partially completed", "Under development"] },
            ownershipType: { type: "string", enum: ["Lease hold", "Free hold"] },
            hasView: { type: "array", items: { type: "string" } },
            hasPool: { type: "boolean" },
            hasCarAccess: { type: "boolean" },
            hasParking: { type: "boolean" },
            propertyType: { type: "string", enum: ["Studio", "Loft", "Penthouse"] }
        }
    }
};

export async function processChat(
    prisma: PrismaClient,
    message: string,
    context?: any,
    conversationHistory?: any[]
): Promise<AIResponse> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'your_openai_api_key_here') {
        // Return a mock response if no API key is set
        return {
            message: `I'm an AI assistant. You said: "${message}". Please configure OPENAI_API_KEY in the backend to enable real AI responses.`,
        };
    }

    try {
        const baseURL = apiKey.startsWith('sk-or-') ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
        // OpenRouter uses different model strings. If OpenRouter, stick to a model that supports tool calling well, like openai/gpt-3.5-turbo or anthropic/claude-3-haiku
        const model = apiKey.startsWith('sk-or-') ? 'anthropic/claude-3-haiku' : 'gpt-3.5-turbo';

        const openai = new OpenAI({
            apiKey,
            baseURL
        });

        const messages: any[] = [
            {
                role: 'system',
                content: `You are a helpful real estate AI assistant for Smart Living Island. 
                 Help users find properties in Bali. When the user asks to find properties (e.g., "Find apartments under $200,000", " villas with ocean view"), you MUST call the "filter_properties" function with extracted filters. If the user asks general questions, just answer them. 
                 Valid areas: Canggu, Seminyak, Bukit, Ubud, Sanur.
                 Valid views: "to the ocean", "to the volcano", "to the rice field", "to the sunrise", "to the jungle", "to the sunset", "to the mountain", "to the pool", "no view". Translate "ocean view" to "to the ocean" etc.`,
            }
        ];

        if (conversationHistory && Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory) {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    messages.push({ role: msg.role, content: msg.content });
                }
            }
        }

        if (context) {
            messages.push({
                role: 'system',
                content: `Current User Context: ${JSON.stringify(context)}`
            });
        }

        messages.push({ role: 'user', content: message });

        const completion = await openai.chat.completions.create({
            model: model,
            messages,
            tools: [{ type: "function", function: functionSchema }],
            tool_choice: "auto"
        });

        const responseMessage = completion.choices[0].message;

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            const toolCall = responseMessage.tool_calls[0] as any;
            const filters = JSON.parse(toolCall.function.arguments);

            // Execute Prisma Query
            const whereBuilding: any = {};
            const whereBlock: any = {};
            const whereUnit: any = { status: { not: 'Sold' } }; // Only available units

            if (filters.areas && filters.areas.length > 0) {
                // Prisma supports filtering `in` case-insensitively only by using map or specific conditions, but exact or mapped matches are better.
                // Assuming areas match casing ("Canggu" etc - they are titlecased in the prompt).
                whereBuilding.area = { in: filters.areas };
            }
            if (filters.hasPool !== undefined) whereBuilding.hasPool = filters.hasPool;
            if (filters.hasCarAccess !== undefined) whereBuilding.hasCarAccess = filters.hasCarAccess;
            if (filters.hasParking !== undefined) whereBuilding.hasParking = filters.hasParking;

            if (filters.category) whereBlock.category = { equals: filters.category, mode: 'insensitive' };
            if (filters.completionStage) whereBlock.constructionStage = { equals: filters.completionStage, mode: 'insensitive' };
            if (filters.ownershipType) whereBlock.typeOfOwnership = { equals: filters.ownershipType, mode: 'insensitive' };

            if (filters.minPrice) whereUnit.price = { ...whereUnit.price, gte: filters.minPrice };
            if (filters.maxPrice) whereUnit.price = { ...whereUnit.price, lte: filters.maxPrice };
            if (filters.minArea) whereUnit.areaM2 = { ...whereUnit.areaM2, gte: filters.minArea };
            if (filters.maxArea) whereUnit.areaM2 = { ...whereUnit.areaM2, lte: filters.maxArea };
            if (filters.minBedrooms) whereUnit.rooms = { ...whereUnit.rooms, gte: filters.minBedrooms };
            if (filters.maxBedrooms) whereUnit.rooms = { ...whereUnit.rooms, lte: filters.maxBedrooms };
            if (filters.propertyType) whereUnit.apartmentTypes = { has: filters.propertyType };
            if (filters.hasView && filters.hasView.length > 0) {
                // If the user specified a view but having_a_view is empty on DB, we might get 0 results. 
                // AI_FILTERS_FINAL.md says to skip filtering if DB is empty, but we can't easily do that in a single DB query.
                // For now, we'll try strict checking as requested in the old backend's AI prompt structure.
                whereUnit.views = { hasSome: filters.hasView };
            }

            // In order to only fetch buildings that match the block/unit filters:
            const buildings = await prisma.building.findMany({
                where: {
                    ...whereBuilding,
                    blocks: {
                        some: {
                            ...whereBlock,
                            units: {
                                some: whereUnit
                            }
                        }
                    }
                },
                include: {
                    blocks: {
                        where: {
                            ...whereBlock,
                            units: {
                                some: whereUnit
                            }
                        },
                        include: {
                            units: {
                                where: whereUnit,
                                orderBy: { price: 'asc' }, // Get cheapest unit first
                                take: 1
                            },
                            _count: {
                                select: { units: { where: whereUnit } }
                            }
                        }
                    }
                },
                take: 20
            });

            // Format for frontend AIPropertyCard
            const relatedBlocks: any[] = [];
            buildings.forEach(building => {
                building.blocks.forEach(block => {
                    if (block.units.length > 0) {
                        const unit = block.units[0];
                        relatedBlocks.push({
                            idComplex: building.id,
                            titleComplex: building.title,
                            titleBlock: block.title,
                            block_id: block.blockUid,
                            category: block.category,
                            area: building.area || 'Unknown',
                            unitWithMinPrice: {
                                price: Number(unit.price),
                                currency: unit.currency || 'USD',
                                bedrooms: unit.rooms
                            },
                            totalUnits: block._count.units
                        });
                    }
                });
            });

            const count = relatedBlocks.length;
            const textResponse = count > 0
                ? `I found ${count} properties that match your criteria.\n\nClick on any property card below to view full details.`
                : `I couldn't find any properties matching exactly those criteria. Could you try adjusting your filters?`;

            return {
                message: textResponse,
                relatedBlocks,
                debugFilters: filters
            };
        }

        return {
            message: responseMessage.content || 'No response generated.',
        };
    } catch (error) {
        console.error('Error in AI service:', error);
        throw new Error('Failed to process AI request');
    }
}
