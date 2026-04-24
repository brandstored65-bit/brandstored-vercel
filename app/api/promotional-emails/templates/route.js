export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { promotionalTemplates, getAllTemplateIds } from '@/lib/promotionalEmailTemplates';

/**
 * API endpoint to get promotional email templates
 * GET - Get all templates or a specific template by ID
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (templateId) {
      // Get specific template
      const template = promotionalTemplates.find(t => t.id === templateId);
      
      if (!template) {
        return NextResponse.json({ 
          success: false, 
          error: 'Template not found',
          availableTemplates: getAllTemplateIds()
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        template: {
          id: template.id,
          subject: template.subject,
          title: template.title,
          subtitle: template.subtitle,
          emoji: template.emoji,
          color: template.color,
          content: template.content,
          cta: template.cta
        }
      });
    }

    // Get all templates (without the actual template function)
    const templates = promotionalTemplates.map(t => ({
      id: t.id,
      subject: t.subject,
      title: t.title,
      subtitle: t.subtitle,
      emoji: t.emoji,
      color: t.color,
      content: t.content,
      cta: t.cta
    }));

    return NextResponse.json({
      success: true,
      totalTemplates: templates.length,
      templates
    });

  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
