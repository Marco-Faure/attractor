const LIBRARY = [
{ id:'solow', glyph:'line', bif:'s', family:'Growth',
  blurb:'Capital per worker accumulates out of saving and erodes through depreciation and population growth. Every economy with the same fundamentals converges to the same steady state.',
  tries:['Raise the saving rate: k* rises, but look at c* in the steady-state panel. It peaks when s equals α, the golden rule.','Open the bifurcation tab with parameter s to see the whole family of steady states at once.','Turn on shock mode and raise s: the time path shows the slow, concave transition typical of Solow.'],
  ref:'Solow (1956), Swan (1956)',
  src:`title: Solow–Swan
k' = s*k^alpha - (n + delta)*k
param s = 0.25 [0.01, 0.95] Saving rate
param alpha = 0.33 [0.05, 0.95] Capital share
param n = 0.01 [0, 0.08] Population growth
param delta = 0.05 [0, 0.2] Depreciation rate
curve Investment s·f(k): s*k^alpha
curve Break-even (n+δ)k: (n + delta)*k
window k [0, 25]
horizon 150
init k = 2
report Output y*: k^alpha
report Consumption c*: (1 - s)*k^alpha`},

{ id:'mrw', glyph:'node', bif:'s_k', family:'Growth',
  blurb:'Solow with a second accumulable factor. Human and physical capital reinforce each other, so saving in either raises long-run income more than in the one-factor model.',
  tries:['Push α + β towards 1: convergence slows down dramatically and the steady state runs away.','Compare the eigenvalues panel as β rises: both eigenvalues approach zero.'],
  ref:'Mankiw, Romer & Weil (1992)',
  src:`title: Solow with human capital
k' = s_k*k^alpha*h^beta - (n + g + delta)*k
h' = s_h*k^alpha*h^beta - (n + g + delta)*h
param s_k = 0.2 [0.02, 0.5] Investment rate, physical capital
param s_h = 0.1 [0.02, 0.4] Investment rate, human capital
param alpha = 0.3 [0.05, 0.6] Physical capital share
param beta = 0.3 [0.05, 0.6] Human capital share
param n = 0.01 [0, 0.05] Population growth
param g = 0.02 [0, 0.05] Technology growth
param delta = 0.05 [0, 0.15] Depreciation rate
window k [0, 15] h [0, 8]
horizon 150
init k = 1, h = 6
report Output y*: k^alpha*h^beta`},

{ id:'ramsey', glyph:'saddle', bif:'rho', family:'Growth',
  blurb:'Households choose consumption optimally. The steady state is a saddle: only one consumption level puts the economy on the path that converges, the green saddle path. Every other choice ends in over-accumulation or in running out of capital.',
  tries:['Click just above and just below the green path: both paths diverge. That is why c must jump.','Turn on shock mode, then lower ρ: consumption drops on impact and the economy climbs the new saddle path.','Raise θ: households smooth consumption more and the saddle path flattens.'],
  ref:'Ramsey (1928), Cass (1965), Koopmans (1965)',
  src:`title: Ramsey–Cass–Koopmans
k' = k^alpha - c - (n + delta)*k
c' = c*(alpha*k^(alpha - 1) - delta - rho)/theta
param alpha = 0.33 [0.1, 0.6] Capital share
param rho = 0.03 [0.005, 0.1] Rate of time preference
param theta = 1 [0.2, 4] Inverse elasticity of substitution
param delta = 0.05 [0, 0.15] Depreciation rate
param n = 0.01 [0, 0.05] Population growth
jump c
window k [0, 30] c [0, 2.6]
horizon 150
init k = 3, c = 0.8
report Output y*: k^alpha
report Interest rate r*: alpha*k^(alpha - 1) - delta`},

{ id:'diamond', glyph:'stair', bif:'A', family:'Growth',
  blurb:'Two-period lives: the young save out of wages, and their savings become next period\'s capital. With log utility and Cobb–Douglas technology, the map is concave and converges monotonically.',
  tries:['Watch the staircase on the 45° diagram: convergence is monotone because the slope is below one.','Raise n and compare the steady state with the golden rule in the panel on the right.'],
  ref:'Diamond (1965)',
  src:`title: Diamond overlapping generations
k(t+1) = beta/(1 + beta)*(1 - alpha)*A*k^alpha/(1 + n)
param alpha = 0.33 [0.05, 0.9] Capital share
param beta = 0.4 [0.05, 1] Generational discount factor
param A = 5 [1, 10] Total factor productivity
param n = 0.3 [0, 1.5] Population growth per generation
window k [0, 1.6]
horizon 25
init k = 0.1
report Wage w*: (1 - alpha)*A*k^alpha
report Gross return R*: alpha*A*k^(alpha - 1)`},

{ id:'day', glyph:'chaos', bif:'B', family:'Growth',
  blurb:'A one-sector growth model with a pollution effect: output falls when capital is too abundant. The hump-shaped map produces cycles and, for strong productivity, chaos.',
  tries:['Open the bifurcation tab with parameter B: steady state, period two, period four, then chaos.','Launch two economies that start almost at the same point: in the chaotic region they soon look unrelated.'],
  ref:'Day (1982)',
  src:`title: Chaotic growth
k(t+1) = s*B*k^beta*(m - k)^gamma/(1 + n)
param B = 10.1 [6, 10.2] Productivity
param s = 0.2 [0.1, 0.3] Saving rate
param beta = 0.5 [0.2, 0.8] Output elasticity
param gamma = 0.5 [0.2, 0.8] Pollution effect
param m = 1 [0.8, 1.2] Capital saturation level
param n = 0.02 [0, 0.1] Population growth
window k [0, 1]
horizon 80
init k = 0.2`},

{ id:'goodwin', glyph:'centre', bif:'rho', family:'Cycles',
  blurb:'Class struggle as predator and prey. High employment lifts wages, which squeeze profits and investment, which lowers employment. The cycle never dies out.',
  tries:['Every orbit is closed: the equilibrium is a centre, with purely imaginary eigenvalues.','Raise ρ, the slope of the Phillips curve: cycles become faster and employment steadier.'],
  ref:'Goodwin (1967)',
  src:`title: Goodwin growth cycle
v' = v*((1 - u)/sigma - (alpha + beta))
u' = u*(rho*v - (gamma + alpha))
param sigma = 3 [1, 6] Capital–output ratio
param alpha = 0.025 [0, 0.06] Productivity growth
param beta = 0.02 [0, 0.05] Labour-force growth
param gamma = 0.8 [0.2, 1.5] Phillips curve intercept
param rho = 0.9 [0.3, 2] Phillips curve slope
label v: employment rate v
label u: wage share u
window v [0.8, 1.02] u [0.72, 1]
horizon 150
init v = 0.9, u = 0.8`},

{ id:'kaldor', glyph:'cycle', bif:'a', family:'Cycles',
  blurb:'Investment responds strongly to income near normal activity and weakly in booms and slumps. When goods markets adjust fast, the equilibrium loses stability and a self-sustained cycle appears.',
  tries:['Lower the adjustment speed a below 2: the cycle disappears and the economy spirals in.','Open the bifurcation tab with parameter a: the cycle is born at a Hopf bifurcation.','Watch the eigenvalues panel as a rises: the complex pair crosses the imaginary axis.'],
  ref:'Kaldor (1940), Chang & Smyth (1971)',
  src:`title: Kaldor business cycle
Y' = a*(I - s*Y)
K' = I - delta*K
let I = s + A*tanh((Y - 1)/w) - b*(K - s/delta)
param a = 3 [0.2, 6] Goods-market adjustment speed
param s = 0.2 [0.05, 0.4] Saving rate
param delta = 0.1 [0.02, 0.3] Depreciation rate
param A = 0.045 [0.01, 0.12] Strength of investment response
param w = 0.15 [0.05, 0.4] Width of normal-activity zone
param b = 0.1 [0.01, 0.4] Capital-stock effect on investment
window Y [0.75, 1.25] K [1.8, 2.2]
horizon 150
init Y = 1.02, K = 2`},

{ id:'samuelson', glyph:'spiral', bif:'v', family:'Cycles',
  blurb:'Consumption follows last period\'s income and investment follows the change in consumption. The accelerator decides whether fluctuations damp, persist or explode.',
  tries:['Raise the accelerator v until c·v exceeds 1: the eigenvalues leave the unit circle and cycles explode.','Try small v and c: the spiral turns into monotone convergence.'],
  ref:'Samuelson (1939)',
  src:`title: Multiplier–accelerator
Y(t+1) = c*(1 + v)*Y - c*v*Z + G
Z(t+1) = Y
param c = 0.8 [0.1, 0.99] Marginal propensity to consume
param v = 0.9 [0, 3] Accelerator
param G = 20 [0, 30] Government spending
label Y: income Y(t)
label Z: last period's income Y(t−1)
window Y [40, 160] Z [40, 160]
horizon 60
init Y = 70, Z = 60`},

{ id:'islm', glyph:'spiral', bif:'M', family:'Macro and open economy',
  blurb:'Output adjusts to excess demand and the interest rate to excess money demand. The equilibrium sits where the IS and LM nullclines cross.',
  tries:['Speed up the money market (β): the path turns from a spiral into a quick slide along the LM curve.','Shock mode, then raise M: the interest rate undershoots before output catches up.'],
  ref:'Hicks (1937), dynamic version after Gandolfo',
  src:`title: IS–LM adjustment
Y' = alpha*(A - b*r - s*Y)
r' = beta*(k*Y - h*r - M)
param A = 60 [30, 90] Autonomous spending
param M = 40 [10, 80] Real money supply
param s = 0.25 [0.05, 0.6] Leakage rate
param b = 4 [0, 12] Investment sensitivity to r
param k = 0.5 [0.1, 1.5] Money demand, income
param h = 5 [0.5, 15] Money demand, interest rate
param alpha = 1 [0.05, 3] Goods-market speed
param beta = 0.2 [0.05, 3] Money-market speed
label Y: output Y
label r: interest rate r
window Y [60, 220] r [0, 14]
horizon 40
init Y = 90, r = 2`},

{ id:'dornbusch', glyph:'saddle', bif:'m', family:'Macro and open economy',
  blurb:'Prices are sticky while the exchange rate jumps. After a monetary expansion, the currency depreciates beyond its new long-run value, then appreciates as prices catch up.',
  tries:['Turn on shock mode and raise m from 1 to 1.1. The exchange rate jumps past its new steady state: that is overshooting.','Raise λ: overshooting shrinks, because money demand absorbs more of the shock.'],
  ref:'Dornbusch (1976)',
  src:`title: Dornbusch overshooting
p' = pi*(u + delta*(e - p) - sigma*i - y)
e' = i - istar
let i = (p - m + phi*y)/lambda
param m = 1 [0.5, 1.5] Money supply (log)
param istar = 0.05 [0, 0.15] Foreign interest rate
param y = 1 [0.5, 1.5] Output (log)
param u = 0.95 [0.5, 1.5] Demand shifter
param delta = 0.5 [0.1, 2] Demand response to real exchange rate
param sigma = 0.5 [0, 2] Demand response to interest rate
param lambda = 2 [0.2, 5] Money demand semi-elasticity
param phi = 1 [0.2, 2] Money demand, income elasticity
param pi = 0.4 [0.05, 2] Price adjustment speed
jump e
label p: price level p (log)
label e: exchange rate e (log)
window p [-0.3, 0.6] e [-0.2, 0.8]
horizon 30
init p = 0, e = 0.5
report Domestic interest rate i: (p - m + phi*y)/lambda`},

{ id:'hommes', glyph:'chaos', bif:'w', family:'Markets and resources',
  blurb:'Producers set supply on the price they expect, and revise expectations adaptively. A steep, bounded supply curve turns the classic cobweb into period doubling and chaos.',
  tries:['Bifurcation tab, parameter w: the steady state splits into two, four, then a chaotic band.','Set w near 0.1: convergence is slow and oscillating, the textbook cobweb. Around w = 0.4, prices never settle.'],
  ref:'Hommes (1994)',
  src:`title: Cobweb with adaptive expectations
p_e(t+1) = (1 - w)*p_e + w*(a - atan(lambda*(p_e - 6)) - 1)/b
param w = 0.4 [0, 1] Weight on the latest price
param lambda = 5 [0.5, 8] Steepness of supply
param a = 1.8 [1.2, 3.5] Demand intercept
param b = 0.25 [0.15, 0.5] Demand slope
label p_e: expected price
window p_e [2, 8.5]
horizon 60
init p_e = 5.5
report Market price: (a - atan(lambda*(p_e - 6)) - 1)/b`},

{ id:'fishery', glyph:'spiral', bif:'p', family:'Markets and resources',
  blurb:'Boats enter while fishing is profitable and leave when it is not. Under open access the rent is fully dissipated: in the long run, effort stops only when profits are zero.',
  tries:['Raise the fish price p: the long-run stock falls. Better prices hurt the resource.','Follow a path: stock and effort chase each other in damped cycles of over-fishing.'],
  ref:'Gordon (1954), Smith (1968)',
  src:`title: Open-access fishery
x' = r*x*(1 - x/K) - q*E*x
E' = eta*(p*q*x - c)*E
param r = 0.5 [0.05, 1.5] Intrinsic growth rate
param K = 1 [0.5, 2] Carrying capacity
param q = 1 [0.2, 2] Catchability
param p = 1 [0.2, 3] Price of fish
param c = 0.3 [0.05, 1] Cost per unit of effort
param eta = 0.5 [0.05, 2] Entry and exit speed
label x: fish stock x
label E: fishing effort E
window x [0, 1.1] E [0, 0.8]
horizon 200
init x = 0.9, E = 0.05
report Harvest: q*E*x
report Resource rent: (p*q*x - c)*E`},

{ id:'tipping', glyph:'bistable', bif:'H', family:'Markets and resources',
  blurb:'A renewable resource under harvesting pressure. Past a threshold, a small increase in pressure makes the stock collapse, and relaxing it again does not bring the stock back.',
  tries:['Bifurcation tab, parameter H: the S-shaped curve shows two tipping points and hysteresis.','Raise H slowly with shock mode on: the stock tracks the high equilibrium, then collapses.'],
  ref:'Ludwig, Jones & Holling (1978), May (1977)',
  src:`title: Harvesting and tipping points
x' = r*x*(1 - x/K) - H*x^2/(a^2 + x^2)
param H = 1.1 [0.4, 2] Harvesting pressure
param r = 0.5 [0.1, 1] Growth rate
param K = 10 [5, 15] Carrying capacity
param a = 1 [0.5, 2] Half-saturation stock
curve Growth: r*x*(1 - x/K)
curve Harvest: H*x^2/(a^2 + x^2)
label x: resource stock x
window x [0, 11]
horizon 120
init x = 8`}
];
if(typeof module!=='undefined') module.exports=LIBRARY;
