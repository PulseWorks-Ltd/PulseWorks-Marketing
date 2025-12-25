import { createCanvas, loadImage, registerFont } from 'canvas';
import type { BrandProfile, ContentType } from '@shared/types';

export interface ImageTemplate {
  type: ContentType;
  title: string;
  subtitle?: string;
  bullets?: string[];
  colorPalette: string[];
  brandName: string;
}

export class ImageGenerator {
  private readonly WIDTH = 1080;
  private readonly HEIGHT = 1080;
  private readonly PADDING = 80;

  async generateImage(template: ImageTemplate): Promise<Buffer> {
    const canvas = createCanvas(this.WIDTH, this.HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background
    const bgColor = template.colorPalette[0] || '#1a365d';
    const accentColor = template.colorPalette[1] || '#3182ce';

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.HEIGHT);
    gradient.addColorStop(0, bgColor);
    gradient.addColorStop(1, this.adjustBrightness(bgColor, -20));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // Content based on type
    if (template.type === 'POST' && template.bullets) {
      await this.renderEducationCard(ctx, template, accentColor);
    } else if (template.type === 'PROMO') {
      await this.renderPromoCard(ctx, template, accentColor);
    } else {
      await this.renderSimpleCard(ctx, template, accentColor);
    }

    // Brand name footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(template.brandName, this.WIDTH / 2, this.HEIGHT - 60);

    return canvas.toBuffer('image/png');
  }

  private async renderEducationCard(
    ctx: CanvasRenderingContext2D,
    template: ImageTemplate,
    accentColor: string
  ): Promise<void> {
    let yPos = this.PADDING + 100;

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'left';

    const titleLines = this.wrapText(ctx, template.title, this.WIDTH - this.PADDING * 2);
    for (const line of titleLines) {
      ctx.fillText(line, this.PADDING, yPos);
      yPos += 80;
    }

    yPos += 40;

    // Bullets
    if (template.bullets) {
      ctx.font = '40px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';

      for (const bullet of template.bullets.slice(0, 3)) {
        // Bullet point
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(this.PADDING + 20, yPos - 12, 12, 0, Math.PI * 2);
        ctx.fill();

        // Text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        const bulletLines = this.wrapText(ctx, bullet, this.WIDTH - this.PADDING * 2 - 60);
        for (const line of bulletLines) {
          ctx.fillText(line, this.PADDING + 60, yPos);
          yPos += 55;
        }
        yPos += 20;
      }
    }
  }

  private async renderPromoCard(
    ctx: CanvasRenderingContext2D,
    template: ImageTemplate,
    accentColor: string
  ): Promise<void> {
    // Center aligned promo
    ctx.textAlign = 'center';
    const centerX = this.WIDTH / 2;
    let yPos = this.HEIGHT / 2 - 100;

    // "SPECIAL OFFER" badge
    ctx.fillStyle = accentColor;
    ctx.fillRect(centerX - 200, yPos - 40, 400, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('SPECIAL OFFER', centerX, yPos + 10);

    yPos += 120;

    // Title
    ctx.font = 'bold 72px sans-serif';
    ctx.fillStyle = '#ffffff';
    const titleLines = this.wrapText(ctx, template.title, this.WIDTH - this.PADDING * 2);
    for (const line of titleLines) {
      ctx.fillText(line, centerX, yPos);
      yPos += 90;
    }

    // Subtitle if exists
    if (template.subtitle) {
      yPos += 30;
      ctx.font = '44px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      const subtitleLines = this.wrapText(ctx, template.subtitle, this.WIDTH - this.PADDING * 2);
      for (const line of subtitleLines) {
        ctx.fillText(line, centerX, yPos);
        yPos += 60;
      }
    }
  }

  private async renderSimpleCard(
    ctx: CanvasRenderingContext2D,
    template: ImageTemplate,
    accentColor: string
  ): Promise<void> {
    // Simple centered text
    ctx.textAlign = 'center';
    const centerX = this.WIDTH / 2;
    const centerY = this.HEIGHT / 2;

    ctx.font = 'bold 80px sans-serif';
    ctx.fillStyle = '#ffffff';

    const titleLines = this.wrapText(ctx, template.title, this.WIDTH - this.PADDING * 2);
    const totalHeight = titleLines.length * 100;
    let yPos = centerY - totalHeight / 2;

    for (const line of titleLines) {
      ctx.fillText(line, centerX, yPos);
      yPos += 100;
    }

    // Decorative line
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(centerX - 300, yPos + 40);
    ctx.lineTo(centerX + 300, yPos + 40);
    ctx.stroke();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    return lines;
  }

  private adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;

    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }
}

export const imageGenerator = new ImageGenerator();
