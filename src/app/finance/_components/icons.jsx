import { Basket as ShoppingBasket, ForkKnife as UtensilsCrossed, Moped as Bike, Car, GasPump as Fuel, ShoppingBag, Repeat, Lightning as Zap, Bank as Landmark, Heartbeat as HeartPulse, FilmSlate as Clapperboard, AirplaneTilt as Plane, Barbell as Dumbbell, GraduationCap, ArrowsLeftRight as ArrowLeftRight, DotsThreeCircle as CircleDot, Question as CircleHelp } from '@phosphor-icons/react';

const ICONS = {
  Groceries: ShoppingBasket,
  'Dining & Cafés': UtensilsCrossed,
  'Food Delivery': Bike,
  Transport: Car,
  Fuel,
  Shopping: ShoppingBag,
  Subscriptions: Repeat,
  'Bills & Utilities': Zap,
  'Government & Fees': Landmark,
  'Health & Pharmacy': HeartPulse,
  Entertainment: Clapperboard,
  Travel: Plane,
  'Personal Care & Fitness': Dumbbell,
  Education: GraduationCap,
  'Transfers & Fees': ArrowLeftRight,
  Other: CircleDot,
};

export function CategoryIcon({ category, size = 17 }) {
  const Icon = ICONS[category] || CircleHelp;
  return <Icon size={size} />;
}

/** Rounded tile with the category glyph; colour stays neutral so it never competes with chart series. */
export function CategoryAvatar({ category, small = false }) {
  return (
    <span className={`fin-avatar ${small ? 'fin-avatar-sm' : ''}`} aria-hidden>
      <CategoryIcon category={category} size={small ? 15 : 17} />
    </span>
  );
}
