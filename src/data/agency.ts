export const agency = {
  name: 'Maharashtra Vision Media',
  shortName: 'MVM',
  instagram: 'https://www.instagram.com/maharashtra_vision_media/',
  instagramHandle: '@maharashtra_vision_media',
  portraits: { jaydeep: '/assets/jaydeep.webp' as string|null, viraj: '/assets/viraj.webp' as string|null },
  services: [
    { id: 'photography', number: '01', title: 'Photography', line: 'The moment. Made timeless.', description: 'Birthdays, car deliveries, products, events, and the moments that deserve more than a snapshot.', icon: 'camera' as const, tags: ['Events', 'Products', 'Life moments'] },
    { id: 'films', number: '02', title: 'Films & reels', line: 'Stories that move people.', description: 'Videography, shoots, and social content with a point of view. From the first frame to the final cut.', icon: 'film' as const, tags: ['Videography', 'Reels', 'Brand content'] },
    { id: 'social', number: '03', title: 'Social & marketing', line: 'Your business. In the frame.', description: 'Content creation and social media management that bring a consistent creative direction to your business.', icon: 'social' as const, tags: ['Management', 'Content', 'Marketing'] },
  ],
  partners: [
    { name: 'Jaydeep', initial: 'J', handle: '@its_jaydeep2524', instagram: 'https://www.instagram.com/its_jaydeep2524/' },
    { name: 'Viraj', initial: 'V', handle: '@viraj_murkute__', instagram: 'https://www.instagram.com/viraj_murkute__/' },
  ],
};
