import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test account
  const account = await prisma.account.upsert({
    where: { id: 'test-account-1' },
    update: {},
    create: {
      id: 'test-account-1',
      name: 'Test Dental Clinic',
      websiteUrl: 'https://example.com',
      plan: 'GROWTH',
      postingAddon: true,
      timezone: 'Pacific/Auckland',
    },
  });

  console.log('✅ Created account:', account.name);

  // Create test user
  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      passwordHash,
      role: 'OWNER',
      accountId: account.id,
    },
  });

  console.log('✅ Created user:', user.email);

  // Create posting rule
  const postingRule = await prisma.postingRule.upsert({
    where: { accountId: account.id },
    update: {},
    create: {
      accountId: account.id,
      frequency: 'TWICE_WEEKLY',
      daysOfWeek: [2, 4], // Tuesday, Thursday
      timeWindow: 'MORNING',
    },
  });

  console.log('✅ Created posting rule');

  // Create social connections (placeholder)
  const fbConnection = await prisma.socialConnection.upsert({
    where: {
      accountId_platform: {
        accountId: account.id,
        platform: 'FACEBOOK',
      },
    },
    update: {},
    create: {
      accountId: account.id,
      provider: 'ayrshare',
      platform: 'FACEBOOK',
      providerProfileId: 'test-fb-profile',
      platformAccountId: '123456789',
      platformAccountName: 'Test Dental Clinic',
      status: 'ACTIVE',
    },
  });

  const igConnection = await prisma.socialConnection.upsert({
    where: {
      accountId_platform: {
        accountId: account.id,
        platform: 'INSTAGRAM',
      },
    },
    update: {},
    create: {
      accountId: account.id,
      provider: 'ayrshare',
      platform: 'INSTAGRAM',
      providerProfileId: 'test-ig-profile',
      platformAccountId: '987654321',
      platformHandle: '@testdentalclinic',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Created social connections');

  // Create verified publishing profile
  const publishingProfile = await prisma.publishingProfile.upsert({
    where: { accountId: account.id },
    update: {},
    create: {
      accountId: account.id,
      facebookProfileId: fbConnection.providerProfileId,
      facebookPageName: fbConnection.platformAccountName!,
      facebookPageId: fbConnection.platformAccountId!,
      instagramProfileId: igConnection.providerProfileId,
      instagramHandle: igConnection.platformHandle!,
      instagramAccountId: igConnection.platformAccountId!,
      status: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedByUserId: user.id,
    },
  });

  console.log('✅ Created publishing profile');

  // Create monthly brief
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);

  const brief = await prisma.monthlyBrief.upsert({
    where: {
      accountId_month: {
        accountId: account.id,
        month: currentMonth,
      },
    },
    update: {},
    create: {
      accountId: account.id,
      month: currentMonth,
      primaryFocus: 'NEW_CLIENTS',
      secondaryFocus: 'EDUCATION',
      promoEnabled: true,
      promoText: 'New patient special: $50 off first visit',
      tone: 'EDUCATIONAL',
      createdByUserId: user.id,
    },
  });

  console.log('✅ Created monthly brief');

  // Create sample content items
  const contentItems = await Promise.all([
    prisma.contentItem.create({
      data: {
        accountId: account.id,
        monthlyBriefId: brief.id,
        month: currentMonth,
        type: 'POST',
        title: 'Why Regular Dental Checkups Matter',
        caption: 'Your smile is an investment in your health. Regular dental checkups can prevent costly problems down the line. Book your 6-month checkup today.',
        hashtags: ['dental', 'oralhealth', 'dentist', 'nz', 'healthysmile'],
        platformTargets: ['FACEBOOK', 'INSTAGRAM'],
        status: 'APPROVED',
        approvedByUserId: user.id,
        approvedAt: new Date(),
        mediaType: 'IMAGE',
        mediaUrl: 'https://via.placeholder.com/1080x1080/1a365d/ffffff?text=Dental+Checkups',
      },
    }),
    prisma.contentItem.create({
      data: {
        accountId: account.id,
        monthlyBriefId: brief.id,
        month: currentMonth,
        type: 'PROMO',
        title: 'New Patient Special',
        caption: 'Welcome to our practice! New patients get $50 off their first visit. Limited time offer - book now.',
        hashtags: ['dentalspecial', 'newpatients', 'nzdental', 'dentist'],
        platformTargets: ['FACEBOOK', 'INSTAGRAM'],
        status: 'DRAFT',
        mediaType: 'IMAGE',
        mediaUrl: 'https://via.placeholder.com/1080x1080/3182ce/ffffff?text=Special+Offer',
      },
    }),
  ]);

  console.log('✅ Created sample content items:', contentItems.length);

  console.log('🎉 Seeding completed!');
  console.log('\n📋 Test credentials:');
  console.log('   Email: test@example.com');
  console.log('   Password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
