// Reference data for the demo. Organisation names follow the public Railway structure;
// every person, roll number and figure is synthetic.

export const RRBS = [
  { id: 'ADI', name: 'RRB Ahmedabad' }, { id: 'AII', name: 'RRB Ajmer' }, { id: 'SBC', name: 'RRB Bengaluru' },
  { id: 'BPL', name: 'RRB Bhopal' }, { id: 'BBS', name: 'RRB Bhubaneswar' }, { id: 'BSP', name: 'RRB Bilaspur' },
  { id: 'CDG', name: 'RRB Chandigarh' }, { id: 'MAS', name: 'RRB Chennai' }, { id: 'GKP', name: 'RRB Gorakhpur' },
  { id: 'GHY', name: 'RRB Guwahati' }, { id: 'JAT', name: 'RRB Jammu-Srinagar' }, { id: 'KOAA', name: 'RRB Kolkata' },
  { id: 'MLDT', name: 'RRB Malda' }, { id: 'BB', name: 'RRB Mumbai' }, { id: 'MFP', name: 'RRB Muzaffarpur' },
  { id: 'PNBE', name: 'RRB Patna' }, { id: 'ALD', name: 'RRB Prayagraj' }, { id: 'RNC', name: 'RRB Ranchi' },
  { id: 'SC', name: 'RRB Secunderabad' }, { id: 'SGUJ', name: 'RRB Siliguri' }, { id: 'TVC', name: 'RRB Thiruvananthapuram' },
];

export const ZONES = [
  { id: 'SWR', name: 'South Western Railway', hq: 'Hubballi', rrb: 'SBC' },
  { id: 'SR', name: 'Southern Railway', hq: 'Chennai', rrb: 'MAS' },
  { id: 'SCR', name: 'South Central Railway', hq: 'Secunderabad', rrb: 'SC' },
  { id: 'CR', name: 'Central Railway', hq: 'Mumbai', rrb: 'BB' },
  { id: 'WR', name: 'Western Railway', hq: 'Mumbai', rrb: 'ADI' },
  { id: 'ECOR', name: 'East Coast Railway', hq: 'Bhubaneswar', rrb: 'BBS' },
];

export const CPOS = ZONES.map((z) => ({ id: 'CPO-' + z.id, zone: z.id, name: 'CPO, ' + z.name + ' (' + z.hq + ')' }));

// Indenting units. kind: division | hq | workshop | construction (sub-layer of a division/HQ)
export const UNITS = [
  { id: 'SBC', zone: 'SWR', rrb: 'SBC', name: 'Bengaluru Division', kind: 'division' },
  { id: 'MYS', zone: 'SWR', rrb: 'SBC', name: 'Mysuru Division', kind: 'division' },
  { id: 'UBL', zone: 'SWR', rrb: 'SBC', name: 'Hubballi Division', kind: 'division' },
  { id: 'SWRHQ', zone: 'SWR', rrb: 'SBC', name: 'Headquarters, SWR', kind: 'hq' },
  { id: 'CWM', zone: 'SWR', rrb: 'SBC', name: 'Central Workshop, Mysuru', kind: 'workshop' },
  { id: 'CNSWR', zone: 'SWR', rrb: 'SBC', name: 'Construction Organisation, SWR', kind: 'construction', parent: 'SWRHQ' },
  { id: 'MAS', zone: 'SR', rrb: 'MAS', name: 'Chennai Division', kind: 'division' },
  { id: 'TPJ', zone: 'SR', rrb: 'MAS', name: 'Tiruchchirappalli Division', kind: 'division' },
  { id: 'TVC', zone: 'SR', rrb: 'TVC', name: 'Thiruvananthapuram Division', kind: 'division' },
  { id: 'SCD', zone: 'SCR', rrb: 'SC', name: 'Secunderabad Division', kind: 'division' },
  { id: 'GTL', zone: 'SCR', rrb: 'SC', name: 'Guntakal Division', kind: 'division' },
  { id: 'BBMU', zone: 'CR', rrb: 'BB', name: 'Mumbai Division (CR)', kind: 'division' },
  { id: 'ADID', zone: 'WR', rrb: 'ADI', name: 'Ahmedabad Division', kind: 'division' },
  { id: 'KUR', zone: 'ECOR', rrb: 'BBS', name: 'Khurda Road Division', kind: 'division' },
];

export const EXAM_GROUPS = [
  { id: 'ALP', name: 'ALP & Technicians', nodal: 'ADI' },
  { id: 'NTPCG', name: 'NTPC (Graduate)', nodal: 'MAS' },
  { id: 'NTPCU', name: 'NTPC (Under Graduate)', nodal: 'CDG' },
  { id: 'JE', name: 'JE, DMS & CMA', nodal: 'SC' },
  { id: 'PARA', name: 'Paramedical Categories', nodal: 'SBC' },
  { id: 'MI', name: 'Ministerial & Isolated', nodal: 'CDG' },
  { id: 'SCTL', name: 'Section Controller', nodal: 'BPL' },
  { id: 'L1', name: 'Level-1 Posts', nodal: 'ALD' },
];

export const PAY = { 1: 18000, 2: 19900, 3: 21700, 4: 25500, 5: 29200, 6: 35400, 7: 44900 };

// Post master. pwbd: suitable sub-categories per disability group, or '' when not suitable.
export const POSTS = [
  { id: 'P101', designation: 'Assistant Loco Pilot', group: 'ALP', dept: 'Mechanical', sub: 'Traction', level: 2, med: 'A1', drq: 100, age: [18, 30], type: 'Safety', training: 52, pwbd: { VI: '', HI: '', LD: '', OD: '', MD: '' }, eq: 'Matriculation plus ITI in a notified trade, or Diploma/Degree in Mechanical/Electrical/Electronics/Automobile Engineering', police: true },
  { id: 'P102', designation: 'Technician Gr III (Signal)', group: 'ALP', dept: 'S&T', sub: 'Signal', level: 2, med: 'B1', drq: 100, age: [18, 33], type: 'Safety', training: 26, pwbd: { VI: '', HI: '', LD: 'OL', OD: '', MD: '' }, eq: 'Matriculation plus ITI in Electrician/Electronics Mechanic/Wireman or Course Completed Act Apprenticeship', police: true },
  { id: 'P103', designation: 'Technician Gr III (Electrical/TRD)', group: 'ALP', dept: 'Electrical', sub: 'TRD', level: 2, med: 'B1', drq: 100, age: [18, 33], type: 'Safety', training: 26, pwbd: { VI: '', HI: '', LD: 'OL', OD: '', MD: '' }, eq: 'Matriculation plus ITI in Electrician/Wireman/Mechanic HT, LT Equipment', police: true },
  { id: 'P104', designation: 'Technician Gr I (Signal)', group: 'ALP', dept: 'S&T', sub: 'Signal', level: 5, med: 'B1', drq: 50, age: [18, 36], type: 'Safety', training: 52, pwbd: { VI: '', HI: 'HH', LD: 'OL', OD: '', MD: '' }, eq: 'B.Sc. in Physics/Electronics/Computer Science/IT or Diploma/Degree in Engineering', police: true },
  { id: 'P201', designation: 'Junior Engineer (Electrical/General Services)', group: 'JE', dept: 'Electrical', sub: 'General Services', level: 6, med: 'B1', drq: 50, age: [18, 33], type: 'Safety', training: 52, pwbd: { VI: '', HI: 'D,HH', LD: 'OL,DW,AAV', OD: '', MD: 'Yes' }, eq: 'Three-year Diploma in Electrical/Electronics Engineering, or a combination of their basic streams', police: true },
  { id: 'P202', designation: 'Junior Engineer (Civil/P-Way)', group: 'JE', dept: 'Engineering', sub: 'P-Way', level: 6, med: 'B1', drq: 50, age: [18, 33], type: 'Safety', training: 52, pwbd: { VI: '', HI: 'HH', LD: 'OL', OD: '', MD: '' }, eq: 'Three-year Diploma in Civil Engineering, or a combination of its basic streams', police: true },
  { id: 'P203', designation: 'Junior Engineer (Information Technology)', group: 'JE', dept: 'Accounts', sub: 'Accounts', level: 6, med: 'C1', drq: 100, age: [18, 33], type: 'Non-safety', training: 52, pwbd: { VI: 'LV', HI: 'D,HH', LD: 'OL,OA,BL,DW,AAV', OD: 'Yes', MD: 'Yes' }, eq: 'PGDCA, B.Sc. (Computer Science), BCA, B.Tech (IT/CS) or DOEACC B-level course', police: false },
  { id: 'P204', designation: 'Depot Material Superintendent', group: 'JE', dept: 'Stores', sub: 'Stores Depot', level: 6, med: 'C1', drq: 100, age: [18, 33], type: 'Non-safety', training: 52, pwbd: { VI: 'LV', HI: 'HH', LD: 'OL,OA', OD: 'Yes', MD: 'Yes' }, eq: 'Three-year Diploma in Engineering in any discipline', police: false },
  { id: 'P205', designation: 'Chemical & Metallurgical Assistant', group: 'JE', dept: 'Mechanical', sub: 'CMT', level: 6, med: 'B1', drq: 100, age: [18, 33], type: 'Non-safety', training: 52, pwbd: { VI: '', HI: 'HH', LD: 'OL', OD: '', MD: '' }, eq: 'B.Sc. with Physics and Chemistry, with at least 45% marks', police: false },
  { id: 'P301', designation: 'Section Controller', group: 'SCTL', dept: 'Operating', sub: 'Control', level: 6, med: 'A2', drq: 60, age: [20, 33], type: 'Safety', training: 30, pwbd: { VI: '', HI: '', LD: '', OD: '', MD: '' }, eq: 'Bachelor’s degree from a recognised university', police: true },
  { id: 'P401', designation: 'Station Master', group: 'NTPCG', dept: 'Operating', sub: 'Traffic', level: 6, med: 'A2', drq: 33, age: [18, 33], type: 'Safety', training: 30, pwbd: { VI: '', HI: '', LD: '', OD: '', MD: '' }, eq: 'Graduation from a recognised university', police: true },
  { id: 'P402', designation: 'Goods Train Manager', group: 'NTPCG', dept: 'Operating', sub: 'Traffic', level: 5, med: 'A2', drq: 60, age: [18, 33], type: 'Safety', training: 26, pwbd: { VI: '', HI: '', LD: '', OD: '', MD: '' }, eq: 'Graduation from a recognised university', police: true },
  { id: 'P403', designation: 'Junior Accounts Assistant cum Typist', group: 'NTPCG', dept: 'Accounts', sub: 'Accounts', level: 5, med: 'C2', drq: 33, age: [18, 33], type: 'Non-safety', training: 10, pwbd: { VI: 'B,LV', HI: 'D,HH', LD: 'OA,OL,BL,OAL,CP,LC,DW,AAV', OD: 'Yes', MD: 'Yes' }, eq: 'Graduation; typing proficiency in English or Hindi on computer', police: false },
  { id: 'P404', designation: 'Chief Commercial cum Ticket Supervisor', group: 'NTPCG', dept: 'Commercial', sub: 'Commercial', level: 6, med: 'C1', drq: 33, age: [18, 33], type: 'Non-safety', training: 12, pwbd: { VI: 'LV', HI: 'HH', LD: 'OA,OL', OD: '', MD: '' }, eq: 'Graduation from a recognised university', police: false },
  { id: 'P501', designation: 'Commercial cum Ticket Clerk', group: 'NTPCU', dept: 'Commercial', sub: 'Commercial', level: 3, med: 'C2', drq: 100, age: [18, 30], type: 'Non-safety', training: 10, pwbd: { VI: 'LV', HI: 'HH', LD: 'OA,OL,BL', OD: 'Yes', MD: 'Yes' }, eq: '12th (+2 stage) or its equivalent with at least 50% marks', police: false },
  { id: 'P502', designation: 'Accounts Clerk cum Typist', group: 'NTPCU', dept: 'Accounts', sub: 'Accounts', level: 2, med: 'C2', drq: 100, age: [18, 30], type: 'Non-safety', training: 0, pwbd: { VI: 'LV', HI: 'D,HH', LD: 'OL,DW,AAV', OD: 'No', MD: 'Yes' }, eq: '12th (+2 stage) with at least 50% marks; typing proficiency on computer', police: false },
  { id: 'P601', designation: 'Staff Nurse', group: 'PARA', dept: 'Medical', sub: 'Nursing', level: 7, med: 'C1', drq: 100, age: [20, 40], type: 'Non-safety', training: 0, pwbd: { VI: '', HI: 'HH', LD: 'OL', OD: '', MD: '' }, eq: 'GNM or B.Sc. (Nursing) and registration as a nurse and midwife', police: false },
  { id: 'P602', designation: 'Pharmacist (Entry Grade)', group: 'PARA', dept: 'Medical', sub: 'Pharmacy', level: 5, med: 'C1', drq: 100, age: [20, 35], type: 'Non-safety', training: 0, pwbd: { VI: '', HI: 'HH', LD: 'OL,OA', OD: '', MD: '' }, eq: '12th with Science plus Diploma or Degree in Pharmacy; registration under the Pharmacy Act', police: false },
  { id: 'P701', designation: 'Junior Stenographer (English)', group: 'MI', dept: 'Personnel', sub: 'Office', level: 4, med: 'C2', drq: 100, age: [18, 30], type: 'Non-safety', training: 0, pwbd: { VI: 'LV', HI: 'D,HH', LD: 'OL,OA', OD: 'Yes', MD: 'Yes' }, eq: '12th (+2 stage); stenography speed 80 wpm', police: false },
  { id: 'P801', designation: 'Track Maintainer Gr IV', group: 'L1', dept: 'Engineering', sub: 'P-Way', level: 1, med: 'B1', drq: 100, age: [18, 33], type: 'Safety', training: 2, pwbd: { VI: '', HI: '', LD: '', OD: '', MD: '' }, eq: '10th pass or ITI or National Apprenticeship Certificate', police: true },
  { id: 'P802', designation: 'Assistant (S&T)', group: 'L1', dept: 'S&T', sub: 'Signal', level: 1, med: 'B1', drq: 100, age: [18, 33], type: 'Safety', training: 2, pwbd: { VI: '', HI: 'HH', LD: 'OL', OD: '', MD: '' }, eq: '10th pass or ITI or National Apprenticeship Certificate', police: true },
  { id: 'P803', designation: 'Pointsman-B', group: 'L1', dept: 'Operating', sub: 'Traffic', level: 1, med: 'A2', drq: 100, age: [18, 33], type: 'Safety', training: 4, pwbd: { VI: '', HI: '', LD: '', OD: '', MD: '' }, eq: '10th pass or ITI or National Apprenticeship Certificate', police: true },
];

export const CATEGORIES = ['UR', 'EWS', 'OBC', 'SC', 'ST'];
export const PWBD = ['VI', 'HI', 'LD', 'OD', 'MD'];
// Central Government DR reservation used for roster checks in the demo (percent of vacancies).
export const ROSTER = { SC: 15, ST: 7.5, OBC: 27, EWS: 10 };
// Minimum qualifying percentage in RRB CBTs as published in recent CENs.
export const QUALIFYING = { UR: 40, EWS: 40, OBC: 30, SC: 30, ST: 25 };
export const MED_STDS = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2'];

export const HOSPITALS = [
  { id: 'UBLCH', name: 'Central Hospital, Hubballi', type: 'Zonal', place: 'Hubballi', zone: 'SWR' },
  { id: 'SBCDH', name: 'Divisional Railway Hospital, Bengaluru', type: 'Divisional', place: 'Bengaluru', zone: 'SWR' },
  { id: 'MYSDH', name: 'Divisional Railway Hospital, Mysuru', type: 'Divisional', place: 'Mysuru', zone: 'SWR' },
  { id: 'ASPSD', name: 'Sub-Divisional Hospital, Ashokapuram', type: 'Sub-Divisional', place: 'Mysuru', zone: 'SWR' },
];

export const CENTRES = [
  { id: 'BLR01', name: 'Exam Centre BLR-01, Peenya', city: 'Bengaluru', seats: 420 },
  { id: 'BLR02', name: 'Exam Centre BLR-02, Electronic City', city: 'Bengaluru', seats: 380 },
  { id: 'BLR03', name: 'Exam Centre BLR-03, Yelahanka', city: 'Bengaluru', seats: 300 },
  { id: 'BLR04', name: 'Exam Centre BLR-04, KR Puram', city: 'Bengaluru', seats: 350 },
  { id: 'MYS01', name: 'Exam Centre MYS-01, Hebbal Industrial Area', city: 'Mysuru', seats: 300 },
  { id: 'MYS02', name: 'Exam Centre MYS-02, Vijayanagar', city: 'Mysuru', seats: 240 },
  { id: 'UBL01', name: 'Exam Centre UBL-01, Gokul Road', city: 'Hubballi', seats: 320 },
  { id: 'UBL02', name: 'Exam Centre UBL-02, Vidyanagar', city: 'Hubballi', seats: 260 },
  { id: 'BGM01', name: 'Exam Centre BGM-01, Udyambag', city: 'Belagavi', seats: 280 },
  { id: 'KLB01', name: 'Exam Centre KLB-01, Aland Road', city: 'Kalaburagi', seats: 220 },
];

export const FIRST = {
  M: ['Aarav', 'Abhishek', 'Aditya', 'Akash', 'Amit', 'Anand', 'Anil', 'Arjun', 'Ashok', 'Bharath', 'Chetan', 'Deepak', 'Dinesh', 'Ganesh', 'Gaurav', 'Harish', 'Imran', 'Jagadeesh', 'Karthik', 'Kiran', 'Kishore', 'Manjunath', 'Manoj', 'Mohan', 'Naveen', 'Nikhil', 'Pradeep', 'Pramod', 'Prashant', 'Rahul', 'Rajesh', 'Rakesh', 'Ravi', 'Rohit', 'Sachin', 'Santosh', 'Shashank', 'Shivakumar', 'Srinivas', 'Sudhir', 'Suresh', 'Tarun', 'Umesh', 'Vijay', 'Vikram', 'Vinay', 'Yogesh', 'Zubair', 'Faisal', 'Joseph'],
  F: ['Aishwarya', 'Akshata', 'Ananya', 'Anitha', 'Bhavya', 'Chaitra', 'Deepa', 'Divya', 'Gayathri', 'Harini', 'Jyothi', 'Kavya', 'Keerthana', 'Lakshmi', 'Meghana', 'Nandini', 'Neha', 'Pooja', 'Priya', 'Rashmi', 'Rekha', 'Sahana', 'Shilpa', 'Shruthi', 'Sneha', 'Sowmya', 'Swathi', 'Tejaswini', 'Vani', 'Varsha', 'Ayesha', 'Mary', 'Farzana', 'Pallavi'],
};
export const LAST = ['Rao', 'Reddy', 'Naik', 'Hegde', 'Patil', 'Kulkarni', 'Gowda', 'Shetty', 'Kumar', 'Sharma', 'Verma', 'Singh', 'Yadav', 'Joshi', 'Desai', 'Bhat', 'Pillai', 'Nair', 'Menon', 'Iyer', 'Murthy', 'Prasad', 'Choudhary', 'Mishra', 'Pandey', 'Khan', 'Shaikh', 'Fernandes', 'D’Souza', 'Biradar', 'Kamble', 'Hiremath', 'Angadi', 'Mallik', 'Das', 'Mohanty', 'Behera', 'Rathod', 'Lamani', 'Sangma'];
export const STATES = [['Karnataka', 0.55], ['Andhra Pradesh', 0.08], ['Telangana', 0.06], ['Tamil Nadu', 0.06], ['Maharashtra', 0.07], ['Kerala', 0.04], ['Uttar Pradesh', 0.06], ['Bihar', 0.05], ['Odisha', 0.03]];
export const CITIES = { Karnataka: ['Bengaluru', 'Mysuru', 'Hubballi', 'Dharwad', 'Belagavi', 'Kalaburagi', 'Ballari', 'Shivamogga', 'Tumakuru', 'Mandya', 'Hassan', 'Davanagere'], 'Andhra Pradesh': ['Anantapur', 'Kurnool', 'Guntur', 'Tirupati'], Telangana: ['Hyderabad', 'Warangal', 'Nizamabad'], 'Tamil Nadu': ['Chennai', 'Salem', 'Hosur', 'Coimbatore'], Maharashtra: ['Kolhapur', 'Pune', 'Solapur', 'Sangli'], Kerala: ['Kochi', 'Kozhikode', 'Thrissur'], 'Uttar Pradesh': ['Prayagraj', 'Varanasi', 'Lucknow'], Bihar: ['Patna', 'Gaya', 'Muzaffarpur'], Odisha: ['Bhubaneswar', 'Cuttack', 'Berhampur'] };
