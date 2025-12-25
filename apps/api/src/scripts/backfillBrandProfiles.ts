import { PrismaClient } from '@prisma/client';
import { brandProfileService } from '../services/brandProfileService';

/**
 * Backfill BrandProfiles for existing accounts
 *
 * This script:
 * 1. Finds accounts without BrandProfile
 * 2. Generates BrandProfile from their website
 * 3. Logs results
 *
 * Run with: npx tsx src/scripts/backfillBrandProfiles.ts
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Starting BrandProfile backfill...\n');

  // Find accounts without BrandProfile
  const accounts = await prisma.account.findMany({
    where: {
      brandProfile: null,
      websiteUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      websiteUrl: true,
    },
  });

  console.log(`📊 Found ${accounts.length} accounts needing BrandProfile\n`);

  if (accounts.length === 0) {
    console.log('✅ All accounts already have BrandProfiles');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const account of accounts) {
    console.log(`Processing: ${account.name}`);
    console.log(`  Website: ${account.websiteUrl}`);

    try {
      const brandProfile = await brandProfileService.generateBrandProfile(
        account.id,
        account.websiteUrl!,
        account.name
      );

      console.log(`  ✅ Created BrandProfile`);
      console.log(`     Confidence: ${brandProfile.confidenceScore}/5`);
      console.log(`     Pillars: ${(brandProfile.contentPillars as string[]).join(', ')}`);
      console.log('');

      success++;
    } catch (error) {
      console.error(`  ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('');
      failed++;
    }

    // Add delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n📈 Backfill Summary:');
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${accounts.length}`);
}

main()
  .catch((error) => {
    console.error('❌ Backfill error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
