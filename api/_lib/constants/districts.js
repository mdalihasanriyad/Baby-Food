// The 64 districts of Bangladesh: [value, English, Bengali]. Single source of truth (the client reads it from the API).
const RAW = [
  ['dhaka', 'Dhaka', 'ঢাকা'], ['gazipur', 'Gazipur', 'গাজীপুর'], ['narayanganj', 'Narayanganj', 'নারায়ণগঞ্জ'], ['narsingdi', 'Narsingdi', 'নরসিংদী'],
  ['manikganj', 'Manikganj', 'মানিকগঞ্জ'], ['munshiganj', 'Munshiganj', 'মুন্সিগঞ্জ'], ['kishoreganj', 'Kishoreganj', 'কিশোরগঞ্জ'], ['tangail', 'Tangail', 'টাঙ্গাইল'],
  ['faridpur', 'Faridpur', 'ফরিদপুর'], ['gopalganj', 'Gopalganj', 'গোপালগঞ্জ'], ['madaripur', 'Madaripur', 'মাদারীপুর'], ['rajbari', 'Rajbari', 'রাজবাড়ী'], ['shariatpur', 'Shariatpur', 'শরীয়তপুর'],
  ['chattogram', 'Chattogram', 'চট্টগ্রাম'], ['coxs-bazar', "Cox's Bazar", 'কক্সবাজার'], ['cumilla', 'Cumilla', 'কুমিল্লা'], ['feni', 'Feni', 'ফেনী'], ['brahmanbaria', 'Brahmanbaria', 'ব্রাহ্মণবাড়িয়া'],
  ['rangamati', 'Rangamati', 'রাঙ্গামাটি'], ['noakhali', 'Noakhali', 'নোয়াখালী'], ['chandpur', 'Chandpur', 'চাঁদপুর'], ['lakshmipur', 'Lakshmipur', 'লক্ষ্মীপুর'], ['khagrachhari', 'Khagrachhari', 'খাগড়াছড়ি'], ['bandarban', 'Bandarban', 'বান্দরবান'],
  ['rajshahi', 'Rajshahi', 'রাজশাহী'], ['bogura', 'Bogura', 'বগুড়া'], ['joypurhat', 'Joypurhat', 'জয়পুরহাট'], ['naogaon', 'Naogaon', 'নওগাঁ'], ['natore', 'Natore', 'নাটোর'],
  ['chapainawabganj', 'Chapainawabganj', 'চাঁপাইনবাবগঞ্জ'], ['pabna', 'Pabna', 'পাবনা'], ['sirajganj', 'Sirajganj', 'সিরাজগঞ্জ'],
  ['rangpur', 'Rangpur', 'রংপুর'], ['dinajpur', 'Dinajpur', 'দিনাজপুর'], ['gaibandha', 'Gaibandha', 'গাইবান্ধা'], ['kurigram', 'Kurigram', 'কুড়িগ্রাম'], ['lalmonirhat', 'Lalmonirhat', 'লালমনিরহাট'],
  ['nilphamari', 'Nilphamari', 'নীলফামারী'], ['panchagarh', 'Panchagarh', 'পঞ্চগড়'], ['thakurgaon', 'Thakurgaon', 'ঠাকুরগাঁও'],
  ['khulna', 'Khulna', 'খুলনা'], ['bagerhat', 'Bagerhat', 'বাগেরহাট'], ['satkhira', 'Satkhira', 'সাতক্ষীরা'], ['jashore', 'Jashore', 'যশোর'], ['jhenaidah', 'Jhenaidah', 'ঝিনাইদহ'],
  ['magura', 'Magura', 'মাগুরা'], ['narail', 'Narail', 'নড়াইল'], ['kushtia', 'Kushtia', 'কুষ্টিয়া'], ['chuadanga', 'Chuadanga', 'চুয়াডাঙ্গা'], ['meherpur', 'Meherpur', 'মেহেরপুর'],
  ['barishal', 'Barishal', 'বরিশাল'], ['patuakhali', 'Patuakhali', 'পটুয়াখালী'], ['bhola', 'Bhola', 'ভোলা'], ['pirojpur', 'Pirojpur', 'পিরোজপুর'], ['jhalokathi', 'Jhalokathi', 'ঝালকাঠি'], ['barguna', 'Barguna', 'বরগুনা'],
  ['sylhet', 'Sylhet', 'সিলেট'], ['moulvibazar', 'Moulvibazar', 'মৌলভীবাজার'], ['habiganj', 'Habiganj', 'হবিগঞ্জ'], ['sunamganj', 'Sunamganj', 'সুনামগঞ্জ'],
  ['mymensingh', 'Mymensingh', 'ময়মনসিংহ'], ['jamalpur', 'Jamalpur', 'জামালপুর'], ['sherpur', 'Sherpur', 'শেরপুর'], ['netrokona', 'Netrokona', 'নেত্রকোনা'],
];
export const DISTRICTS = RAW.map(([value, en, bn]) => ({ value, en, bn }));
export const DISTRICT_VALUES = DISTRICTS.map((d) => d.value);
export const DISTRICT_BY_VALUE = new Map(DISTRICTS.map((d) => [d.value, d]));
