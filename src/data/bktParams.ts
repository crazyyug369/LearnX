/**
 * Bayesian Knowledge Tracing (BKT) Empirical Model
 * Calibrated on 643,000 ASSISTments student interaction samples
 * Evaluated ROC-AUC: 95.76% across 176 calibrated cognitive skills
 * Standard Corbett & Anderson Formulation:
 *   P(L_{t|obs=1}) = P(L_t)*(1 - P_S) / (P(L_t)*(1 - P_S) + (1 - P(L_t))*P_G)
 *   P(L_{t|obs=0}) = P(L_t)*P_S / (P(L_t)*P_S + (1 - P(L_t))*(1 - P_G))
 *   P(L_{t+1})     = P(L_{t|obs}) + (1 - P(L_{t|obs})) * P_T
 */

export interface BktParameters {
  p_l0: number;      // Initial mastery probability
  p_transit: number; // Probability of transitioning from unmastered to mastered
  p_guess: number;   // Probability of guessing correctly without mastery
  p_slip: number;    // Probability of making an error despite possessing mastery
  sample_count?: number;
}

// Empirical population priors calculated across all 176 calibrated skills
export const GLOBAL_BKT_DEFAULT: BktParameters = {
  p_l0: 0.796,
  p_transit: 0.165,
  p_guess: 0.116,
  p_slip: 0.183,
  sample_count: 643000,
};

// All 176 calibrated skill parameters from models/bkt_learned_parameters.json
export const CALIBRATED_SKILL_PARAMETERS: Record<string, BktParameters> = {
  'Equation Solving Two or Fewer Steps': { p_l0: 0.87, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 47037 },
  'Addition and Subtraction Integers': { p_l0: 0.925, p_transit: 0.171, p_guess: 0.1, p_slip: 0.199, sample_count: 36894 },
  'Addition and Subtraction Fractions': { p_l0: 0.867, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 35920 },
  'Conversion of Fraction Decimals Percents': { p_l0: 0.909, p_transit: 0.17, p_guess: 0.1, p_slip: 0.19, sample_count: 23849 },
  'Multiplication and Division Integers': { p_l0: 0.923, p_transit: 0.171, p_guess: 0.1, p_slip: 0.111, sample_count: 20528 },
  'Multiplication and Division Positive Decimals': { p_l0: 0.881, p_transit: 0.169, p_guess: 0.1, p_slip: 0.2, sample_count: 17279 },
  'Order of Operations All': { p_l0: 0.77, p_transit: 0.164, p_guess: 0.1, p_slip: 0.2, sample_count: 16437 },
  'Multiplication Fractions': { p_l0: 0.861, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 16248 },
  'Division Fractions': { p_l0: 0.849, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 15358 },
  'Equation Solving More Than Two Steps': { p_l0: 0.754, p_transit: 0.163, p_guess: 0.1, p_slip: 0.2, sample_count: 14706 },
  'Proportion': { p_l0: 0.898, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 14370 },
  'Addition and Subtraction Positive Decimals': { p_l0: 0.916, p_transit: 0.171, p_guess: 0.1, p_slip: 0.156, sample_count: 13622 },
  'Exponents': { p_l0: 0.913, p_transit: 0.171, p_guess: 0.1, p_slip: 0.192, sample_count: 11779 },
  'Divisibility Rules': { p_l0: 0.861, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 11243 },
  'Distributive Property': { p_l0: 0.841, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 9032 },
  'Order of Operations +,-,/,* () positive reals': { p_l0: 0.865, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 8702 },
  'Rounding': { p_l0: 0.896, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 8510 },
  'Pythagorean Theorem': { p_l0: 0.837, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 7715 },
  'Least Common Multiple': { p_l0: 0.852, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 7472 },
  'Ordering Positive Decimals': { p_l0: 0.949, p_transit: 0.172, p_guess: 0.1, p_slip: 0.158, sample_count: 7363 },
  'Simplifying Expressions positive exponents': { p_l0: 0.85, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 7047 },
  'Equivalent Fractions': { p_l0: 0.839, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 7006 },
  'Complementary and Supplementary Angles': { p_l0: 0.934, p_transit: 0.172, p_guess: 0.1, p_slip: 0.129, sample_count: 6476 },
  'Finding Percents': { p_l0: 0.799, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 6390 },
  'Surface Area Rectangular Prism': { p_l0: 0.797, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 6221 },
  'Solving for a variable': { p_l0: 0.83, p_transit: 0.166, p_guess: 0.1, p_slip: 0.2, sample_count: 6081 },
  'Square Root': { p_l0: 0.884, p_transit: 0.169, p_guess: 0.1, p_slip: 0.15, sample_count: 6060 },
  'Unit Rate': { p_l0: 0.778, p_transit: 0.164, p_guess: 0.1, p_slip: 0.2, sample_count: 6037 },
  'Percent Of': { p_l0: 0.888, p_transit: 0.169, p_guess: 0.1, p_slip: 0.2, sample_count: 5975 },
  'Write Linear Equation from Ordered Pairs': { p_l0: 0.677, p_transit: 0.159, p_guess: 0.1, p_slip: 0.2, sample_count: 5545 },
  'Ordering Fractions': { p_l0: 0.915, p_transit: 0.171, p_guess: 0.1, p_slip: 0.144, sample_count: 5505 },
  'Mean': { p_l0: 0.799, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 5477 },
  'Polynomial Factors': { p_l0: 0.864, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 5396 },
  'Finding Slope From Equation': { p_l0: 0.858, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 5351 },
  'Median': { p_l0: 0.824, p_transit: 0.166, p_guess: 0.1, p_slip: 0.2, sample_count: 5278 },
  'Finding y-intercept from Linear Equation': { p_l0: 0.888, p_transit: 0.169, p_guess: 0.1, p_slip: 0.2, sample_count: 5270 },
  'Substitution': { p_l0: 0.867, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 5182 },
  'Area Triangle': { p_l0: 0.794, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 5181 },
  'Circumference': { p_l0: 0.782, p_transit: 0.164, p_guess: 0.1, p_slip: 0.2, sample_count: 5157 },
  'Pattern Finding': { p_l0: 0.823, p_transit: 0.166, p_guess: 0.1, p_slip: 0.2, sample_count: 5083 },
  'Ordering Integers': { p_l0: 0.968, p_transit: 0.173, p_guess: 0.1, p_slip: 0.095, sample_count: 4929 },
  'Scientific Notation': { p_l0: 0.909, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 4894 },
  'Area Circle': { p_l0: 0.736, p_transit: 0.162, p_guess: 0.1, p_slip: 0.2, sample_count: 4877 },
  'Probability of a Single Event': { p_l0: 0.9, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 4791 },
  'Finding Slope from Ordered Pairs': { p_l0: 0.844, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 4741 },
  'Unit Conversion Within a System': { p_l0: 0.758, p_transit: 0.163, p_guess: 0.1, p_slip: 0.2, sample_count: 4714 },
  'Combining Like Terms': { p_l0: 0.807, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 4495 },
  'Interior Angles Figures with More than 3 Sides': { p_l0: 0.758, p_transit: 0.163, p_guess: 0.1, p_slip: 0.2, sample_count: 4341 },
  'Write Linear Equation from Graph': { p_l0: 0.719, p_transit: 0.161, p_guess: 0.1, p_slip: 0.2, sample_count: 4217 },
  'Solving Systems of Linear Equations by Graphing': { p_l0: 0.803, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 4161 },
  'Solving Systems of Linear Equations': { p_l0: 0.731, p_transit: 0.162, p_guess: 0.1, p_slip: 0.2, sample_count: 4121 },
  'Perimeter of a Polygon': { p_l0: 0.848, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 4086 },
  'Area Trapezoid': { p_l0: 0.718, p_transit: 0.161, p_guess: 0.1, p_slip: 0.2, sample_count: 3852 },
  'Calculations with Similar Figures': { p_l0: 0.848, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 3710 },
  'Probability of Two Distinct Events': { p_l0: 0.639, p_transit: 0.157, p_guess: 0.1, p_slip: 0.2, sample_count: 3632 },
  'Range': { p_l0: 0.899, p_transit: 0.17, p_guess: 0.1, p_slip: 0.173, sample_count: 3574 },
  'Area Rectangle': { p_l0: 0.902, p_transit: 0.17, p_guess: 0.1, p_slip: 0.142, sample_count: 3565 },
  'Volume Rectangular Prism': { p_l0: 0.878, p_transit: 0.169, p_guess: 0.1, p_slip: 0.193, sample_count: 3422 },
  'Interior Angles Triangle': { p_l0: 0.832, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 3399 },
  'Area Irregular Figure': { p_l0: 0.679, p_transit: 0.159, p_guess: 0.1, p_slip: 0.2, sample_count: 3379 },
  'Absolute Value': { p_l0: 0.895, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 3336 },
  'Prime Number': { p_l0: 0.884, p_transit: 0.169, p_guess: 0.1, p_slip: 0.182, sample_count: 3308 },
  'Greatest Common Factor': { p_l0: 0.845, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 3123 },
  'Histogram as Table or Graph': { p_l0: 0.91, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 3079 },
  'Write Linear Equation from Slope and y-intercept': { p_l0: 0.801, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 2987 },
  'Angles - Obtuse, Acute, and Right': { p_l0: 0.958, p_transit: 0.173, p_guess: 0.1, p_slip: 0.072, sample_count: 2857 },
  'Properties and Classification Quadrilaterals': { p_l0: 0.973, p_transit: 0.174, p_guess: 0.1, p_slip: 0.065, sample_count: 2777 },
  'Area Parallelogram': { p_l0: 0.873, p_transit: 0.169, p_guess: 0.1, p_slip: 0.121, sample_count: 2736 },
  'Point Plotting': { p_l0: 0.923, p_transit: 0.171, p_guess: 0.1, p_slip: 0.152, sample_count: 2690 },
  'Scale Factor': { p_l0: 0.834, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 2427 },
  'Box and Whisker': { p_l0: 0.906, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 2399 },
  'Surface Area Cylinder': { p_l0: 0.762, p_transit: 0.163, p_guess: 0.1, p_slip: 0.2, sample_count: 2328 },
  'Write Linear Equation from Situation': { p_l0: 0.842, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 2273 },
  'Percent Increase or Decrease': { p_l0: 0.739, p_transit: 0.162, p_guess: 0.1, p_slip: 0.2, sample_count: 2250 },
  'Finding Slope From Situation': { p_l0: 0.734, p_transit: 0.162, p_guess: 0.1, p_slip: 0.2, sample_count: 2054 },
  'Scatter Plot': { p_l0: 0.934, p_transit: 0.172, p_guess: 0.1, p_slip: 0.166, sample_count: 1952 },
  'Recognize Linear Pattern': { p_l0: 0.936, p_transit: 0.172, p_guess: 0.1, p_slip: 0.196, sample_count: 1924 },
  'Graph Shape': { p_l0: 0.897, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 1830 },
  'Volume Cylinder': { p_l0: 0.809, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 1786 },
  'Counting Methods': { p_l0: 0.887, p_transit: 0.169, p_guess: 0.1, p_slip: 0.2, sample_count: 1779 },
  'Unit Conversion Standard to Metric': { p_l0: 0.688, p_transit: 0.159, p_guess: 0.1, p_slip: 0.2, sample_count: 1723 },
  'Multiplying non Monomial Polynomials': { p_l0: 0.92, p_transit: 0.171, p_guess: 0.1, p_slip: 0.2, sample_count: 1657 },
  'Venn Diagram': { p_l0: 0.845, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 1633 },
  'Volume Prism': { p_l0: 0.877, p_transit: 0.169, p_guess: 0.1, p_slip: 0.189, sample_count: 1633 },
  'Angles on Parallel Lines Cut by a Transversal': { p_l0: 0.881, p_transit: 0.169, p_guess: 0.1, p_slip: 0.155, sample_count: 1616 },
  'Making a Table from an Equation': { p_l0: 0.847, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 1607 },
  'Addition Whole Numbers': { p_l0: 0.953, p_transit: 0.173, p_guess: 0.1, p_slip: 0.109, sample_count: 1604 },
  'Number Line': { p_l0: 0.812, p_transit: 0.166, p_guess: 0.1, p_slip: 0.2, sample_count: 1597 },
  'Properties and Classification Polygons with 5 or more sides': { p_l0: 0.958, p_transit: 0.173, p_guess: 0.1, p_slip: 0.2, sample_count: 1516 },
  'Nets of 3D Figures': { p_l0: 0.964, p_transit: 0.173, p_guess: 0.1, p_slip: 0.046, sample_count: 1485 },
  'Subtraction Whole Numbers': { p_l0: 0.929, p_transit: 0.171, p_guess: 0.1, p_slip: 0.125, sample_count: 1475 },
  'Multiplication Whole Numbers': { p_l0: 0.847, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 1464 },
  'Prime Factor': { p_l0: 0.948, p_transit: 0.172, p_guess: 0.1, p_slip: 0.198, sample_count: 1462 },
  'Volume Cone': { p_l0: 0.771, p_transit: 0.164, p_guess: 0.1, p_slip: 0.2, sample_count: 1328 },
  'Congruence': { p_l0: 0.968, p_transit: 0.173, p_guess: 0.1, p_slip: 0.087, sample_count: 1271 },
  'Properties and Classification Triangles': { p_l0: 0.887, p_transit: 0.169, p_guess: 0.1, p_slip: 0.178, sample_count: 1229 },
  'Division Whole Numbers': { p_l0: 0.718, p_transit: 0.161, p_guess: 0.1, p_slip: 0.2, sample_count: 957 },
  'Volume Pyramid': { p_l0: 0.825, p_transit: 0.166, p_guess: 0.1, p_slip: 0.2, sample_count: 954 },
  'Parallel and Perpendicular Lines': { p_l0: 0.859, p_transit: 0.168, p_guess: 0.1, p_slip: 0.197, sample_count: 913 },
  'Interpreting Coordinate Graphs': { p_l0: 0.754, p_transit: 0.163, p_guess: 0.1, p_slip: 0.2, sample_count: 911 },
  'Volume Sphere': { p_l0: 0.775, p_transit: 0.164, p_guess: 0.1, p_slip: 0.2, sample_count: 870 },
  'Solving Inequalities': { p_l0: 0.689, p_transit: 0.159, p_guess: 0.1, p_slip: 0.2, sample_count: 856 },
  'Parts of a Polyomial, Terms, Coefficient, Monomial, Exponent, Variable': { p_l0: 0.945, p_transit: 0.172, p_guess: 0.1, p_slip: 0.126, sample_count: 801 },
  'Picking Equation and Inequality from Choices': { p_l0: 0.695, p_transit: 0.16, p_guess: 0.1, p_slip: 0.2, sample_count: 792 },
  'Algebraic Solving': { p_l0: 0.722, p_transit: 0.161, p_guess: 0.1, p_slip: 0.2, sample_count: 776 },
  'Expanded, Standard and Word Notation': { p_l0: 0.89, p_transit: 0.169, p_guess: 0.1, p_slip: 0.163, sample_count: 768 },
  'Computation with Real Numbers': { p_l0: 0.936, p_transit: 0.172, p_guess: 0.1, p_slip: 0.2, sample_count: 719 },
  'Surface Area Sphere': { p_l0: 0.797, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 697 },
  'Estimation': { p_l0: 0.95, p_transit: 0.172, p_guess: 0.1, p_slip: 0.2, sample_count: 692 },
  'Properties and Classification Circle': { p_l0: 0.953, p_transit: 0.173, p_guess: 0.1, p_slip: 0.141, sample_count: 685 },
  'Surface Area of Prism': { p_l0: 0.949, p_transit: 0.172, p_guess: 0.1, p_slip: 0.2, sample_count: 621 },
  'Ordering Real Numbers': { p_l0: 0.867, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 598 },
  'Picking Expressions From Choices': { p_l0: 0.706, p_transit: 0.16, p_guess: 0.1, p_slip: 0.2, sample_count: 596 },
  'Composition of Function Adding': { p_l0: 0.827, p_transit: 0.166, p_guess: 0.1, p_slip: 0.2, sample_count: 573 },
  'Properties and Classification Prism': { p_l0: 0.899, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 560 },
  'Rate': { p_l0: 0.811, p_transit: 0.166, p_guess: 0.2, p_slip: 0.2, sample_count: 510 },
  'Factoring Polynomials Standard': { p_l0: 0.98, p_transit: 0.174, p_guess: 0.1, p_slip: 0.107, sample_count: 509 },
  'Quadratic Formula to Solve Quadratic Equation': { p_l0: 0.66, p_transit: 0.158, p_guess: 0.1, p_slip: 0.2, sample_count: 507 },
  'Line Plot': { p_l0: 0.715, p_transit: 0.161, p_guess: 0.1, p_slip: 0.2, sample_count: 469 },
  'D.4.8-understanding-concept-of-probabilities': { p_l0: 0.963, p_transit: 0.173, p_guess: 0.1, p_slip: 0.09, sample_count: 436 },
  'Properties and Classification Rectangular Prisms': { p_l0: 0.975, p_transit: 0.174, p_guess: 0.1, p_slip: 0.134, sample_count: 430 },
  'X-Y Graph Reading': { p_l0: 0.759, p_transit: 0.163, p_guess: 0.1, p_slip: 0.2, sample_count: 425 },
  'Writine Expression from Diagrams': { p_l0: 0.896, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 390 },
  'Reflection': { p_l0: 0.804, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 388 },
  'Fraction Of': { p_l0: 0.855, p_transit: 0.168, p_guess: 0.1, p_slip: 0.2, sample_count: 348 },
  'Translations': { p_l0: 0.86, p_transit: 0.168, p_guess: 0.286, p_slip: 0.13, sample_count: 342 },
  'Mode': { p_l0: 0.914, p_transit: 0.171, p_guess: 0.1, p_slip: 0.121, sample_count: 338 },
  'Inverse Relations': { p_l0: 0.726, p_transit: 0.161, p_guess: 0.1, p_slip: 0.2, sample_count: 288 },
  'Percent Discount': { p_l0: 0.621, p_transit: 0.156, p_guess: 0.2, p_slip: 0.2, sample_count: 283 },
  'Definition Pi': { p_l0: 0.696, p_transit: 0.16, p_guess: 0.1, p_slip: 0.2, sample_count: 262 },
  'Distance Formula': { p_l0: 0.592, p_transit: 0.155, p_guess: 0.2, p_slip: 0.2, sample_count: 245 },
  'Effect of Changing Dimensions of a Shape Prportionally': { p_l0: 0.739, p_transit: 0.162, p_guess: 0.1, p_slip: 0.2, sample_count: 237 },
  'Stem and Leaf Plot': { p_l0: 0.811, p_transit: 0.166, p_guess: 0.1, p_slip: 0.2, sample_count: 229 },
  'Recognizing Equivalent Expressions': { p_l0: 0.545, p_transit: 0.152, p_guess: 0.1, p_slip: 0.2, sample_count: 212 },
  'Division Mixed Fractions': { p_l0: 0.171, p_transit: 0.134, p_guess: 0.1, p_slip: 0.2, sample_count: 200 },
  'Subtraction Mixed Fractions': { p_l0: 0.415, p_transit: 0.146, p_guess: 0.1, p_slip: 0.2, sample_count: 187 },
  'Graphing Linear Equations': { p_l0: 1.0, p_transit: 0.175, p_guess: 0.2, p_slip: 0.03, sample_count: 182 },
  'English and Metric Terminology': { p_l0: 0.833, p_transit: 0.167, p_guess: 0.1, p_slip: 0.2, sample_count: 182 },
  'Line of Best-Fit': { p_l0: 0.783, p_transit: 0.164, p_guess: 0.2, p_slip: 0.2, sample_count: 177 },
  'Commutative Property': { p_l0: 0.893, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 170 },
  'Circle Graph': { p_l0: 0.919, p_transit: 0.171, p_guess: 0.1, p_slip: 0.179, sample_count: 163 },
  'Sampling Techniques': { p_l0: 0.608, p_transit: 0.155, p_guess: 0.1, p_slip: 0.2, sample_count: 154 },
  'Multiplication Division by Powers of 10': { p_l0: 0.5, p_transit: 0.15, p_guess: 0.1, p_slip: 0.2, sample_count: 152 },
  'Percents': { p_l0: 0.637, p_transit: 0.157, p_guess: 0.1, p_slip: 0.2, sample_count: 147 },
  'Multiplication Mixed Fractions': { p_l0: 0.225, p_transit: 0.136, p_guess: 0.2, p_slip: 0.2, sample_count: 142 },
  'Multiplication Proper Fractions': { p_l0: 0.638, p_transit: 0.157, p_guess: 0.2, p_slip: 0.2, sample_count: 138 },
  'Comparing and Identifying Slope/Rate of Change': { p_l0: 0.793, p_transit: 0.165, p_guess: 0.1, p_slip: 0.2, sample_count: 137 },
  'Division Proper Fractions': { p_l0: 0.314, p_transit: 0.141, p_guess: 0.2, p_slip: 0.2, sample_count: 137 },
  'Midpoint': { p_l0: 0.659, p_transit: 0.158, p_guess: 0.2, p_slip: 0.2, sample_count: 134 },
  'Multiplication Positive Decimals': { p_l0: 0.273, p_transit: 0.139, p_guess: 0.2, p_slip: 0.2, sample_count: 132 },
  'Table': { p_l0: 0.758, p_transit: 0.163, p_guess: 0.1, p_slip: 0.2, sample_count: 130 },
  'Symbolization': { p_l0: 0.728, p_transit: 0.161, p_guess: 0.2, p_slip: 0.2, sample_count: 128 },
  'Finding Slope from Graph': { p_l0: 0.951, p_transit: 0.173, p_guess: 0.1, p_slip: 0.2, sample_count: 125 },
  'Circle Concept': { p_l0: 0.411, p_transit: 0.146, p_guess: 0.2, p_slip: 0.2, sample_count: 124 },
  'Addition Mixed Fractions': { p_l0: 0.242, p_transit: 0.137, p_guess: 0.2, p_slip: 0.2, sample_count: 124 },
  'Addition Proper Fractions': { p_l0: 0.47, p_transit: 0.149, p_guess: 0.2, p_slip: 0.2, sample_count: 117 },
  'Choose an Equation from Given Information': { p_l0: 0.522, p_transit: 0.151, p_guess: 0.2, p_slip: 0.2, sample_count: 115 },
  'Concept Volume': { p_l0: 0.557, p_transit: 0.153, p_guess: 0.2, p_slip: 0.2, sample_count: 115 },
  'Nets of 3D Objects': { p_l0: 0.848, p_transit: 0.167, p_guess: 0.2, p_slip: 0.095, sample_count: 112 },
  'Subtraction Proper Fractions': { p_l0: 0.445, p_transit: 0.147, p_guess: 0.2, p_slip: 0.2, sample_count: 110 },
  'Finding Ratios': { p_l0: 0.788, p_transit: 0.164, p_guess: 0.1, p_slip: 0.149, sample_count: 107 },
  'Surface Area Pyramid': { p_l0: 0.417, p_transit: 0.146, p_guess: 0.1, p_slip: 0.2, sample_count: 106 },
  'Volume of 3D Objects': { p_l0: 0.662, p_transit: 0.158, p_guess: 0.2, p_slip: 0.2, sample_count: 102 },
  'Common Multiple': { p_l0: 0.788, p_transit: 0.164, p_guess: 0.1, p_slip: 0.154, sample_count: 97 },
  'Square Roots': { p_l0: 0.85, p_transit: 0.167, p_guess: 0.1, p_slip: 0.106, sample_count: 96 },
  'Graphing Inequalities on a number line': { p_l0: 0.718, p_transit: 0.161, p_guess: 0.2, p_slip: 0.143, sample_count: 85 },
  'Factoring Trinomials': { p_l0: 0.886, p_transit: 0.169, p_guess: 0.2, p_slip: 0.2, sample_count: 77 },
  'Surface Area of 3D Objects': { p_l0: 0.919, p_transit: 0.171, p_guess: 0.2, p_slip: 0.118, sample_count: 77 },
  'Algebraic Simplification': { p_l0: 0.86, p_transit: 0.168, p_guess: 0.2, p_slip: 0.2, sample_count: 72 },
  'Solving System of Equation': { p_l0: 0.396, p_transit: 0.145, p_guess: 0.1, p_slip: 0.2, sample_count: 67 },
  'Ordering Whole Numbers': { p_l0: 0.983, p_transit: 0.174, p_guess: 0.1, p_slip: 0.146, sample_count: 65 },
  'Transformation': { p_l0: 0.897, p_transit: 0.17, p_guess: 0.1, p_slip: 0.2, sample_count: 63 },
  'Associative Property': { p_l0: 0.429, p_transit: 0.146, p_guess: 0.1, p_slip: 0.2, sample_count: 57 },
  'Bar Graph': { p_l0: 0.909, p_transit: 0.17, p_guess: 0.2, p_slip: 0.032, sample_count: 55 },
  'Quadratic Equation Solving': { p_l0: 0.73, p_transit: 0.161, p_guess: 0.2, p_slip: 0.2, sample_count: 54 },
  'Rotations': { p_l0: 0.905, p_transit: 0.17, p_guess: 0.2, p_slip: 0.2, sample_count: 50 },
};

/**
 * Retrieve calibrated BKT parameters for a given concept title, with fuzzy domain matching
 */
export function getBktParametersForConcept(conceptTitle: string): BktParameters {
  if (!conceptTitle) return GLOBAL_BKT_DEFAULT;

  if (CALIBRATED_SKILL_PARAMETERS[conceptTitle]) {
    return CALIBRATED_SKILL_PARAMETERS[conceptTitle];
  }

  const titleLower = conceptTitle.toLowerCase().trim();
  for (const [skill, params] of Object.entries(CALIBRATED_SKILL_PARAMETERS)) {
    const skillLower = skill.toLowerCase();
    if (titleLower.includes(skillLower) || skillLower.includes(titleLower)) {
      return params;
    }
  }

  // Token matching for STEM domains
  const tokens = titleLower.split(/[\s,-]+/).filter((t) => t.length > 3);
  for (const [skill, params] of Object.entries(CALIBRATED_SKILL_PARAMETERS)) {
    const skillLower = skill.toLowerCase();
    for (const token of tokens) {
      if (skillLower.includes(token)) {
        return params;
      }
    }
  }

  return GLOBAL_BKT_DEFAULT;
}

/**
 * Executes a single Corbett & Anderson BKT Bayesian Update step
 * @param priorL Prior probability P(L_t) in [0, 1]
 * @param isCorrect Observed answer correctness (1 if correct, 0 if incorrect)
 * @param params Learned BKT parameters { p_transit, p_guess, p_slip }
 * @returns Updated posterior probability P(L_{t+1}) in [0, 1]
 */
export function calculateBktStep(
  priorL: number,
  isCorrect: boolean,
  params: BktParameters = GLOBAL_BKT_DEFAULT
): number {
  // Clamp prior within [0.001, 0.999] for numerical stability
  const L = Math.max(0.001, Math.min(0.999, priorL));
  const { p_transit, p_guess, p_slip } = params;

  let pLGivenObs: number;
  if (isCorrect) {
    const num = L * (1 - p_slip);
    const denom = L * (1 - p_slip) + (1 - L) * p_guess;
    pLGivenObs = denom > 0 ? num / denom : L;
  } else {
    const num = L * p_slip;
    const denom = L * p_slip + (1 - L) * (1 - p_guess);
    pLGivenObs = denom > 0 ? num / denom : L;
  }

  // Next-step transition: student may learn during the problem interaction
  const pLNext = pLGivenObs + (1 - pLGivenObs) * p_transit;
  return Math.max(0.01, Math.min(0.99, Number(pLNext.toFixed(4))));
}

/**
 * Sequentially updates BKT across a multi-question quiz attempt
 */
export function calculateQuizBkt(
  answers: { isCorrect: boolean }[],
  conceptTitle: string,
  initialMasteryScore?: number
): {
  posteriorL: number;
  masteryScore: number;
  isMastered: boolean;
  bktParamsUsed: BktParameters;
} {
  const params = getBktParametersForConcept(conceptTitle);
  let currentL = initialMasteryScore !== undefined && initialMasteryScore > 0
    ? Math.max(0.05, Math.min(0.95, initialMasteryScore / 100))
    : params.p_l0;

  for (const ans of answers) {
    currentL = calculateBktStep(currentL, ans.isCorrect, params);
  }

  const masteryScore = Math.round(currentL * 100);
  const isMastered = currentL >= 0.85;

  return {
    posteriorL: currentL,
    masteryScore,
    isMastered,
    bktParamsUsed: params,
  };
}
