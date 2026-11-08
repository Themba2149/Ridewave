import { Car, FileCheck2, MapPin, Receipt, Route, Star, type LucideIcon } from 'lucide-react';
import type { AccordionItem } from '../../components/ui/Accordion';

export type Step = { icon: LucideIcon; title: string; text: string };

export const passengerSteps: Step[] = [
  { icon: MapPin, title: 'Set your trip', text: 'Enter your pickup point and destination.' },
  { icon: Car, title: 'Choose a ride', text: 'Compare categories and see an upfront estimate with a full fare breakdown.' },
  { icon: Route, title: 'Get matched', text: 'We look for an available, approved driver in your category. If none is free, we tell you plainly and let you retry or cancel.' },
  { icon: Receipt, title: 'Ride and receive a receipt', text: 'Follow the trip status to the end, get an itemised receipt, then rate your driver.' },
];

export const driverSteps: Step[] = [
  { icon: FileCheck2, title: 'Register', text: 'Create a driver account with your contact and vehicle details.' },
  { icon: FileCheck2, title: 'Submit documents', text: 'Upload the required documents. They are stored privately and only reviewers can open them.' },
  { icon: Star, title: 'Get approved', text: 'An administrator reviews your application. You can go online once approved.' },
  { icon: Car, title: 'Accept rides', text: 'Receive nearby requests, accept or decline, and track your earnings.' },
];

export const passengerBenefits = ['Upfront fare estimates with a transparent breakdown', 'Driver and vehicle details shown once matched', 'Itemised receipts for every completed ride', 'Saved places and ride history in one dashboard'];
export const driverBenefits = ['Accept or decline each request', 'Earnings summaries by day, week and month', 'Clear fare and commission breakdown per trip', 'Manage your vehicle and documents in one place'];

export const faqs: AccordionItem[] = [
  { question: 'Is RideWave available to book right now?', answer: 'Not yet. This is a development demonstration: rides, drivers and payments are simulated, and no real trips are booked.' },
  { question: 'How is my fare calculated?', answer: 'A base fare plus distance and time charges, any applicable fees, and a minimum fare. The server calculates the estimate and shows the breakdown before you confirm. The final fare is shown on your receipt.' },
  { question: 'What if no driver is available?', answer: 'We say so clearly. You can retry the request or cancel it.' },
  { question: 'Which payment methods are supported?', answer: 'Cash, card and digital wallet options are planned. In this demonstration all payments are simulated and clearly labelled as such.' },
  { question: 'How do I become a driver?', answer: 'Register a driver account, add your vehicle details and submit the required documents. An administrator reviews each application.' },
  { question: 'Where can I get help?', answer: 'Use the contact form on the Contact page. In an emergency, contact the emergency services directly first.' },
];

export const safetyFeatures = [
  { title: 'Driver and vehicle details', text: 'After a match you see your driver’s name, rating and vehicle so you can check them at pickup.', status: 'Planned for booking (Phase 4)' },
  { title: 'Trip details on record', text: 'Each ride’s route, status changes and fare are stored so there is a clear record of the trip.', status: 'Planned for booking (Phase 4)' },
  { title: 'Support access', text: 'Contact the support team from the Contact page; messages are stored as support tickets.', status: 'Available in this demo' },
  { title: 'Driver approval workflow', text: 'Drivers cannot receive rides until an administrator approves them. In this demo, approvals are simulated and documents are not verified against real records.', status: 'Planned (Phases 5–6)' },
  { title: 'Trip sharing', text: 'Sharing live trip details with a trusted contact is a planned feature.', status: 'Not yet built' },
];
