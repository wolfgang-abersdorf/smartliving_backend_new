import { FastifyInstance } from 'fastify';
import { createPdfOverlay } from '../../services/pdf.service';

export default async function (fastify: FastifyInstance) {
    // GET /overlay endpoint
    fastify.get('/overlay', {
        schema: {
            querystring: {
                type: 'object',
                required: ['pdf_url', 'contacts_data'],
                properties: {
                    file_name: { type: 'string' },
                    pdf_url: { type: 'string', format: 'uri' },
                    contacts_data: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { pdf_url, contacts_data, file_name } = request.query as any;
            const contacts = JSON.parse(contacts_data);

            const pdfBuffer = await createPdfOverlay(
                pdf_url,
                contacts,
                contacts.photo || undefined
            );

            reply.header('Content-Type', 'application/pdf');
            reply.header('Content-Disposition', `attachment; filename="${file_name || 'document'}_with_contacts.pdf"`);
            return reply.send(pdfBuffer);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ success: false, message: 'PDF Generation Failed' });
        }
    });

    // POST /direct-url endpoint
    fastify.post('/direct-url', {
        schema: {
            body: {
                type: 'object',
                required: ['pdf_url'],
                properties: {
                    pdf_url: { type: 'string', format: 'uri' }
                }
            }
        }
    }, async (request, reply) => {
        // If the original URL is a WordPress attachment URL or some indirect proxy,
        // this endpoint's goal is to resolve it to a direct CDN or local path.
        // For now, return the exact URL we received, as we don't apply complex resolving yet,
        // but the frontend requires this structural endpoint.
        const { pdf_url } = request.body as any;

        return reply.send({
            success: true,
            direct_url: pdf_url
        });
    });
}
