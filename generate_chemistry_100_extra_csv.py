import csv

# 100 Additional Basic General Chemistry MCQs (Items 201-300) across all 11 topics
questions = [
    # Topic 1: Atoms, molecules and chemical formulae (201-209)
    (201, "What is the charge of an electron?", "+1", "-1", "0", "+2", "B", "Electrons carry a unit negative charge (-1).", "Atoms, molecules and chemical formulae", "easy"),
    (202, "Which part of the atom contains almost all of its mass?", "Electron cloud", "Nucleus", "Valence shell", "Orbitals", "B", "The nucleus contains protons and neutrons, which account for nearly all atomic mass.", "Atoms, molecules and chemical formulae", "easy"),
    (203, "What is the chemical symbol for Potassium?", "P", "Po", "K", "Pt", "C", "Potassium's symbol K comes from its Latin name, Kalium.", "Atoms, molecules and chemical formulae", "easy"),
    (204, "What is the chemical symbol for Sodium?", "So", "S", "Na", "Sn", "C", "Sodium's symbol Na comes from Natrium.", "Atoms, molecules and chemical formulae", "easy"),
    (205, "What is the chemical formula for calcium carbonate?", "CaCO3", "Ca2CO3", "Ca(CO3)2", "CaCO2", "A", "Calcium (Ca2+) and carbonate (CO3^2-) combine in a 1:1 ratio as CaCO3.", "Atoms, molecules and chemical formulae", "easy"),
    (206, "How many hydrogen atoms are in one molecule of methane (CH4)?", "1", "2", "3", "4", "D", "The subscript 4 after H indicates 4 hydrogen atoms.", "Atoms, molecules and chemical formulae", "easy"),
    (207, "Which of the following is a polyatomic ion?", "Na+", "Cl-", "SO4^2-", "Mg2+", "C", "Sulfate (SO4^2-) is a charged group of covalently bonded atoms.", "Atoms, molecules and chemical formulae", "easy"),
    (208, "What is the chemical formula for magnesium chloride?", "MgCl", "MgCl2", "Mg2Cl", "Mg2Cl2", "B", "Mg2+ requires two Cl- ions to balance charge: MgCl2.", "Atoms, molecules and chemical formulae", "easy"),
    (209, "A pure substance made of only one type of atom is called an:", "Element", "Compound", "Mixture", "Alloy", "A", "Elements consist of atoms with the same atomic number.", "Atoms, molecules and chemical formulae", "easy"),

    # Topic 2: The modern electronic theory of the atom (210-218)
    (210, "How many electrons can a p-subshell hold in total?", "2", "6", "10", "14", "B", "A p-subshell has 3 orbitals, each holding 2 electrons = 6 electrons.", "The modern electronic theory of the atom", "easy"),
    (211, "How many electrons can a d-subshell hold in total?", "2", "6", "10", "14", "C", "A d-subshell has 5 orbitals, each holding 2 electrons = 10 electrons.", "The modern electronic theory of the atom", "easy"),
    (212, "How many orbitals are in an s-subshell?", "1", "3", "5", "7", "A", "An s-subshell consists of a single spherical orbital.", "The modern electronic theory of the atom", "easy"),
    (213, "What is the electron configuration of Neon (atomic number 10)?", "1s2 2s2 2p4", "1s2 2s2 2p6", "1s2 2s2 2p5", "1s2 2s2 3s2", "B", "Neon has 10 electrons: 2 + 2 + 6 = 10.", "The modern electronic theory of the atom", "easy"),
    (214, "Which quantum number describes the spin direction of an electron?", "Principal (n)", "Azimuthal (l)", "Magnetic (m)", "Spin (ms)", "D", "The spin quantum number (ms) is +1/2 or -1/2.", "The modern electronic theory of the atom", "easy"),
    (215, "When an electron jumps from a higher energy level to a lower energy level, it:", "Absorbs energy", "Emits energy (light)", "Becomes a proton", "Stops moving", "B", "Dropping to a lower energy level releases a photon of light.", "The modern electronic theory of the atom", "easy"),
    (216, "Which subshell is filled immediately after 3p according to the Aufbau Principle?", "3d", "4s", "4p", "2d", "B", "4s has lower energy than 3d, so 4s fills before 3d.", "The modern electronic theory of the atom", "medium"),
    (217, "How many valence electrons does Chlorine (atomic number 17) have?", "1", "5", "7", "8", "C", "Chlorine is 2, 8, 7, so it has 7 valence electrons.", "The modern electronic theory of the atom", "easy"),
    (218, "The Pauli Exclusion Principle states that no two electrons in the same atom can have:", "The same mass", "The exact same set of four quantum numbers", "Opposite spins", "Different energy levels", "B", "Two electrons in the same orbital must have opposite spins.", "The modern electronic theory of the atom", "medium"),

    # Topic 3: The periodic table and its trends (219-227)
    (219, "Elements in Group 2 (IIA) are called:", "Alkali metals", "Alkaline earth metals", "Halogens", "Noble gases", "B", "Group 2 elements (Be, Mg, Ca, etc.) are alkaline earth metals.", "The periodic table and its trends", "easy"),
    (220, "Which of the following is a halogen?", "Argon (Ar)", "Bromine (Br)", "Calcium (Ca)", "Potassium (K)", "B", "Bromine (Br) is in Group 17 (halogens).", "The periodic table and its trends", "easy"),
    (221, "Which of the following is a noble gas?", "Nitrogen (N)", "Helium (He)", "Oxygen (O)", "Hydrogen (H)", "B", "Helium (He) is in Group 18 (noble gases).", "The periodic table and its trends", "easy"),
    (222, "Which element has the largest atomic radius in Period 2 (Li to Ne)?", "Lithium (Li)", "Carbon (C)", "Fluorine (F)", "Neon (Ne)", "A", "Atomic radius decreases from left to right, so Lithium on the far left is largest.", "The periodic table and its trends", "easy"),
    (223, "Down a group, ionization energy generally:", "Increases", "Decreases", "Stays the same", "Doubles", "B", "Outer electrons are farther from the nucleus and easier to remove down a group.", "The periodic table and its trends", "easy"),
    (224, "Which of these elements is a liquid metal at room temperature?", "Iron", "Mercury", "Sodium", "Copper", "B", "Mercury (Hg) is the only metal that is liquid at standard room temperature.", "The periodic table and its trends", "easy"),
    (225, "Which of these elements is a liquid nonmetal at room temperature?", "Chlorine", "Bromine", "Iodine", "Sulfur", "B", "Bromine (Br2) is a reddish-brown liquid at room temperature.", "The periodic table and its trends", "easy"),
    (226, "Cations are always _______ than their parent neutral atoms.", "Larger", "Smaller", "The same size", "Heavier", "B", "Losing electrons reduces electron-electron repulsion and often removes the outer shell, making cations smaller.", "The periodic table and its trends", "medium"),
    (227, "Anions are always _______ than their parent neutral atoms.", "Smaller", "Larger", "The same size", "Lighter", "B", "Gaining electrons increases electron-electron repulsion, expanding the electron cloud.", "The periodic table and its trends", "medium"),

    # Topic 4: The concept of hybridization (228-236)
    (228, "How many hybrid orbitals are produced in sp3 hybridization?", "2", "3", "4", "6", "C", "Mixing 1 s orbital + 3 p orbitals gives 4 sp3 hybrid orbitals.", "The concept of hybridization", "easy"),
    (229, "What is the hybridization of each carbon atom in ethane (C2H6)?", "sp", "sp2", "sp3", "sp3d", "C", "Each carbon in ethane forms 4 single bonds, so it is sp3 hybridized.", "The concept of hybridization", "easy"),
    (230, "What is the hybridization of the central carbon atom in CO2 (O=C=O)?", "sp", "sp2", "sp3", "sp3d", "A", "Carbon in CO2 has 2 double bonds (2 electron regions) and is linear, so it is sp hybridized.", "The concept of hybridization", "medium"),
    (231, "What is the hybridization of boron in BF3 (trigonal planar)?", "sp", "sp2", "sp3", "sp3d", "B", "BF3 has 3 bonding regions and trigonal planar geometry, corresponding to sp2 hybridization.", "The concept of hybridization", "easy"),
    (232, "Which bond is stronger: a sigma bond or a pi bond?", "Pi bond", "Sigma bond", "Both are equal", "Neither", "B", "Head-on overlap in a sigma bond is greater than sideways overlap in a pi bond, making sigma stronger.", "The concept of hybridization", "easy"),
    (233, "How many sigma bonds are in a methane (CH4) molecule?", "1", "2", "3", "4", "D", "CH4 has 4 C-H single bonds, each of which is a sigma bond.", "The concept of hybridization", "easy"),
    (234, "How many pi bonds are in an ethene (C2H4) molecule?", "0", "1", "2", "4", "B", "Ethene has one C=C double bond, which contains 1 sigma and 1 pi bond.", "The concept of hybridization", "easy"),
    (235, "What is the percent s-character in an sp3 hybrid orbital?", "25%", "33.3%", "50%", "75%", "A", "1 s orbital out of 4 total orbitals (1s + 3p) = 25% s-character.", "The concept of hybridization", "medium"),
    (236, "What is the percent s-character in an sp hybrid orbital?", "25%", "33.3%", "50%", "100%", "C", "1 s orbital out of 2 total orbitals (1s + 1p) = 50% s-character.", "The concept of hybridization", "medium"),

    # Topic 5: Stoichiometry of reaction (237-245)
    (237, "What is the molar mass of NaCl? (Na = 23, Cl = 35.5)", "48.5 g/mol", "58.5 g/mol", "60.0 g/mol", "71.0 g/mol", "B", "23 + 35.5 = 58.5 g/mol.", "Stoichiometry of reaction", "easy"),
    (238, "How many moles are in 88 g of CO2 (molar mass = 44 g/mol)?", "1 mol", "2 mol", "3 mol", "4 mol", "B", "88 / 44 = 2 moles.", "Stoichiometry of reaction", "easy"),
    (239, "In 2H2 + O2 -> 2H2O, if 4 moles of H2 react with excess O2, how many moles of H2O form?", "2 moles", "4 moles", "6 moles", "8 moles", "B", "The ratio of H2 to H2O is 2:2 (1:1), so 4 moles of H2 give 4 moles of H2O.", "Stoichiometry of reaction", "easy"),
    (240, "What is the percentage by mass of hydrogen in H2O? (H = 1, O = 16)", "5.6%", "11.1%", "50.0%", "88.9%", "B", "(2 / 18) x 100 = 11.1%.", "Stoichiometry of reaction", "medium"),
    (241, "How many molecules are in 0.5 moles of O2?", "6.02 x 10^23", "3.01 x 10^23", "1.20 x 10^24", "1.50 x 10^23", "B", "0.5 x 6.02 x 10^23 = 3.01 x 10^23 molecules.", "Stoichiometry of reaction", "easy"),
    (242, "What is the volume of 2 moles of CO2 gas at STP?", "11.2 L", "22.4 L", "44.8 L", "67.2 L", "C", "2 moles x 22.4 L/mol = 44.8 L.", "Stoichiometry of reaction", "easy"),
    (243, "Which formula gives the actual number of atoms of each element in a molecule?", "Empirical formula", "Molecular formula", "Structural formula only", "Ionic formula", "B", "The molecular formula shows the exact number of each atom in a molecule.", "Stoichiometry of reaction", "easy"),
    (244, "If 10 g of reactant A reacts completely with 15 g of reactant B, what is the total mass of products?", "5 g", "15 g", "25 g", "150 g", "C", "By conservation of mass, 10 g + 15 g = 25 g of products.", "Stoichiometry of reaction", "easy"),
    (245, "What is the molarity of a solution with 1 mole of KCl dissolved in 0.5 L of solution?", "0.5 M", "1.0 M", "2.0 M", "4.0 M", "C", "Molarity = 1 mol / 0.5 L = 2.0 M.", "Stoichiometry of reaction", "easy"),

    # Topic 6: Redox reaction (246-254)
    (246, "In a redox reaction, oxidation and reduction always occur:", "Separately in different beakers", "Simultaneously", "One hour apart", "Only in acids", "B", "Electrons lost in oxidation must be gained in reduction at the same time.", "Redox reaction", "easy"),
    (247, "What is the oxidation number of oxygen in H2O2 (hydrogen peroxide)?", "-2", "-1", "0", "+1", "B", "In peroxides like H2O2, oxygen has an oxidation state of -1.", "Redox reaction", "medium"),
    (248, "What is the oxidation number of Mn in MnO4- (permanganate ion)?", "+4", "+5", "+7", "+2", "C", "Mn + 4(-2) = -1 -> Mn = +7.", "Redox reaction", "medium"),
    (249, "Which substance is the oxidizing agent in: 2Na + Cl2 -> 2NaCl?", "Na", "Cl2", "NaCl", "Neither", "B", "Cl2 gains electrons (is reduced to Cl-), so Cl2 is the oxidizing agent.", "Redox reaction", "easy"),
    (250, "Which substance is the reducing agent in: 2Na + Cl2 -> 2NaCl?", "Na", "Cl2", "NaCl", "Neither", "A", "Na loses electrons (is oxidized to Na+), so Na is the reducing agent.", "Redox reaction", "easy"),
    (251, "In terms of hydrogen, reduction is the:", "Removal of hydrogen", "Addition of hydrogen", "Removal of electrons", "Addition of oxygen", "B", "Classically, reduction is the gain of hydrogen or loss of oxygen.", "Redox reaction", "easy"),
    (252, "What is the oxidation number of Cr in Cr2O7^2-?", "+3", "+6", "+7", "+12", "B", "2Cr + 7(-2) = -2 -> 2Cr = +12 -> Cr = +6.", "Redox reaction", "medium"),
    (253, "In an electrochemical cell, reduction always occurs at the:", "Anode", "Cathode", "Salt bridge", "External wire", "B", "RED CAT: Reduction occurs at the cathode.", "Redox reaction", "easy"),
    (254, "When Cu2+ gains 2 electrons to form Cu, the copper ion is:", "Oxidized", "Reduced", "Neutralized", "Evaporated", "B", "Gaining electrons is reduction.", "Redox reaction", "easy"),

    # Topic 7: Acid base and salt and its theories (255-263)
    (255, "What is the pH of pure water at 25 degrees C?", "0", "5", "7", "14", "C", "Pure water is neutral with pH = 7.", "Acid base and salt and its theories", "easy"),
    (256, "Which of the following pH values represents the strongest acid?", "pH 1", "pH 4", "pH 6", "pH 7", "A", "Lower pH means higher H+ concentration and stronger acidity.", "Acid base and salt and its theories", "easy"),
    (257, "Which of the following pH values represents the strongest base?", "pH 8", "pH 10", "pH 13", "pH 7", "C", "Higher pH (closer to 14) means stronger basicity.", "Acid base and salt and its theories", "easy"),
    (258, "What is the conjugate acid of NH3?", "NH2-", "NH4+", "N2", "H+", "B", "When NH3 accepts a proton (H+), it forms its conjugate acid NH4+.", "Acid base and salt and its theories", "easy"),
    (259, "Which acid is found in vinegar?", "Sulfuric acid", "Acetic acid (ethanoic acid)", "Nitric acid", "Hydrochloric acid", "B", "Vinegar is a dilute aqueous solution of acetic acid.", "Acid base and salt and its theories", "easy"),
    (260, "Which indicator turns pink in basic solutions and is colorless in acidic solutions?", "Litmus", "Phenolphthalein", "Methyl orange", "Universal indicator", "B", "Phenolphthalein is colorless in acid and pink/magenta in base.", "Acid base and salt and its theories", "easy"),
    (261, "A substance that can act as both an acid and a base (like water) is called:", "Neutral", "Amphoteric", "Isotonic", "Inert", "B", "Amphoteric (amphiprotic) substances can both donate and accept protons.", "Acid base and salt and its theories", "easy"),
    (262, "What gas is produced when an acid reacts with a carbonate (like CaCO3)?", "Hydrogen", "Oxygen", "Carbon dioxide", "Chlorine", "C", "Acid + Carbonate -> Salt + Water + CO2.", "Acid base and salt and its theories", "easy"),
    (263, "A Lewis base is defined as an:", "Electron pair donor", "Electron pair acceptor", "Proton donor", "Proton acceptor", "A", "A Lewis base donates a lone pair of electrons to form a coordinate covalent bond.", "Acid base and salt and its theories", "medium"),

    # Topic 8: Chemical equilibrium (264-272)
    (264, "What symbol is used for the equilibrium constant expressed in terms of partial pressures?", "Kc", "Kp", "Ka", "Ksp", "B", "Kp uses partial pressures of gaseous reactants and products.", "Chemical equilibrium", "easy"),
    (265, "If Kc < 1, what does it mean at equilibrium?", "Products are favored", "Reactants are favored", "The reaction is complete", "No reactants remain", "B", "Kc < 1 means the denominator (reactants) is larger than the numerator (products).", "Chemical equilibrium", "easy"),
    (266, "In a reversible reaction, what happens when the system is cooled for an exothermic forward reaction?", "Shifts left", "Shifts right (toward products)", "Stops", "No change", "B", "Removing heat (cooling) shifts an exothermic reaction right to produce more heat.", "Chemical equilibrium", "medium"),
    (267, "A double arrow (<->) in a chemical equation indicates:", "A fast reaction", "A reversible reaction", "An explosion", "A catalyst is present", "B", "The double arrow shows that both forward and reverse reactions occur.", "Chemical equilibrium", "easy"),
    (268, "If more product is added to a system at equilibrium, the equilibrium shifts:", "To the right", "To the left (toward reactants)", "Does not shift", "Increases temperature", "B", "Adding product causes the reverse reaction to speed up, shifting left.", "Chemical equilibrium", "easy"),
    (269, "Which of the following does NOT shift the position of equilibrium?", "Changing temperature", "Adding a catalyst", "Adding a reactant", "Changing pressure (when gas moles differ)", "B", "Catalysts speed up both directions equally without shifting equilibrium.", "Chemical equilibrium", "easy"),
    (270, "For a reaction with equal moles of gas on both sides, increasing pressure:", "Shifts right", "Shifts left", "Has no effect on equilibrium position", "Doubles Kc", "C", "Pressure only shifts gaseous equilibria when total gas moles differ between sides.", "Chemical equilibrium", "easy"),
    (271, "The Haber process is used industrially to manufacture:", "Sulfuric acid", "Ammonia (NH3)", "Nitric acid", "Sodium hydroxide", "B", "N2 + 3H2 <-> 2NH3 is the Haber process for ammonia synthesis.", "Chemical equilibrium", "easy"),
    (272, "At equilibrium, the reaction:", "Has completely stopped", "Continues in both directions at equal rates", "Only goes forward", "Only goes backward", "B", "Dynamic equilibrium means both forward and reverse reactions continue at equal rates.", "Chemical equilibrium", "easy"),

    # Topic 9: The colligative properties of solution (273-281)
    (273, "Which of the following is a colligative property?", "Color", "Boiling point elevation", "pH", "Refractive index", "B", "Boiling point elevation depends on the number of solute particles.", "The colligative properties of solution", "easy"),
    (274, "Pure water boils at 100 degrees C at 1 atm. A saltwater solution will boil at:", "Below 100 degrees C", "Above 100 degrees C", "Exactly 100 degrees C", "0 degrees C", "B", "Dissolved solute raises the boiling point above 100 degrees C.", "The colligative properties of solution", "easy"),
    (275, "Pure water freezes at 0 degrees C. A saltwater solution will freeze at:", "Above 0 degrees C", "Below 0 degrees C", "Exactly 0 degrees C", "100 degrees C", "B", "Dissolved solute lowers the freezing point below 0 degrees C.", "The colligative properties of solution", "easy"),
    (276, "In osmosis, water moves from a region of:", "High solute concentration to low solute concentration", "Low solute concentration to high solute concentration", "High pressure to low pressure only", "Solid to gas", "B", "Water flows toward the more concentrated (hypertonic) side to dilute it.", "The colligative properties of solution", "easy"),
    (277, "Which solution has the highest osmotic pressure at the same temperature?", "0.1 M glucose", "0.1 M NaCl", "0.1 M CaCl2", "Pure water", "C", "0.1 M CaCl2 produces 0.3 M of ions (3 particles per formula unit).", "The colligative properties of solution", "medium"),
    (278, "A 0.9% NaCl solution is _______ with human red blood cells.", "Hypertonic", "Hypotonic", "Isotonic", "Saturated", "C", "Normal saline (0.9% NaCl) has the same osmotic pressure as blood plasma.", "The colligative properties of solution", "easy"),
    (279, "Why does adding a non-volatile solute lower the vapor pressure of a solvent?", "It increases temperature", "Fewer solvent molecules are at the surface to escape", "It makes the solvent heavier", "It reacts with air", "B", "Solute particles occupy surface area, reducing the rate of solvent evaporation.", "The colligative properties of solution", "easy"),
    (280, "What is the van't Hoff factor (i) for sucrose (sugar) in water?", "0", "1", "2", "3", "B", "Sucrose is a molecular non-electrolyte, so i = 1.", "The colligative properties of solution", "easy"),
    (281, "Which unit is defined as moles of solute per kilogram of solvent?", "Molarity", "Molality", "Normality", "Mole fraction", "B", "Molality (m) = moles of solute / kg of solvent.", "The colligative properties of solution", "easy"),

    # Topic 10: Chemical kinetics and thermodynamics (282-291)
    (282, "What happens to the rate of most chemical reactions when temperature is increased?", "It decreases", "It increases", "It stops", "It becomes zero", "B", "Higher temperature gives molecules more kinetic energy, increasing effective collisions.", "Chemical kinetics and thermodynamics", "easy"),
    (283, "A substance that slows down a chemical reaction without being consumed is called an:", "Catalyst", "Inhibitor", "Reactant", "Enzyme", "B", "An inhibitor decreases reaction rate.", "Chemical kinetics and thermodynamics", "easy"),
    (284, "Biological catalysts in living organisms are called:", "Hormones", "Enzymes", "Vitamins", "Lipids", "B", "Enzymes are proteins that catalyze biochemical reactions.", "Chemical kinetics and thermodynamics", "easy"),
    (285, "In an energy diagram, the difference between products and reactants is:", "Activation energy", "Enthalpy change (delta H)", "Rate constant", "Entropy", "B", "Delta H = H(products) - H(reactants).", "Chemical kinetics and thermodynamics", "easy"),
    (286, "If a reaction feels cold to the touch, it is:", "Exothermic", "Endothermic", "Nuclear", "Spontaneous only at 0 K", "B", "An endothermic reaction absorbs heat from your hand, making it feel cold.", "Chemical kinetics and thermodynamics", "easy"),
    (287, "Which of the following processes represents an increase in entropy?", "Freezing water", "Boiling water into steam", "Condensing steam", "Crystallizing salt", "B", "Liquid to gas greatly increases molecular disorder (entropy).", "Chemical kinetics and thermodynamics", "easy"),
    (288, "What is the SI unit of energy and heat?", "Watt", "Joule", "Newton", "Pascal", "B", "The Joule (J) is the SI unit of energy.", "Chemical kinetics and thermodynamics", "easy"),
    (289, "For a reaction at equilibrium, what is the value of Gibbs free energy change (delta G)?", "Positive", "Negative", "Zero", "Infinite", "C", "At equilibrium, delta G = 0.", "Chemical kinetics and thermodynamics", "medium"),
    (290, "Which of the following does NOT affect the rate of a reaction?", "Temperature", "Catalyst", "Surface area", "Color of the container", "D", "Container color does not affect collision frequency or activation energy.", "Chemical kinetics and thermodynamics", "easy"),
    (291, "Hess's Law states that the total enthalpy change of a reaction:", "Depends on the path taken", "Is independent of the path taken", "Is always zero", "Is always positive", "B", "Enthalpy is a state function, so delta H depends only on initial and final states.", "Chemical kinetics and thermodynamics", "medium"),

    # Topic 11: Radioactivity and nuclear chemistry (292-300)
    (292, "Which scientist won two Nobel Prizes for her pioneering work on radioactivity?", "Rosalind Franklin", "Marie Curie", "Lise Meitner", "Dorothy Hodgkin", "B", "Marie Curie discovered polonium and radium and coined the term radioactivity.", "Radioactivity and nuclear chemistry", "easy"),
    (293, "Which type of radiation has NO electrical charge?", "Alpha", "Beta", "Gamma", "Positron", "C", "Gamma rays are neutral electromagnetic radiation.", "Radioactivity and nuclear chemistry", "easy"),
    (294, "Which type of radiation is deflected toward the negative plate in an electric field?", "Alpha particles (+2)", "Beta particles (-1)", "Gamma rays (0)", "Neutrons (0)", "A", "Positively charged alpha particles are attracted to the negative plate.", "Radioactivity and nuclear chemistry", "easy"),
    (295, "When a nucleus emits a beta-minus particle, its atomic number:", "Decreases by 2", "Increases by 1", "Decreases by 1", "Stays the same", "B", "A neutron turns into a proton + electron, increasing atomic number by 1.", "Radioactivity and nuclear chemistry", "medium"),
    (296, "When a nucleus emits a gamma ray, its mass number:", "Increases by 4", "Decreases by 4", "Increases by 1", "Stays the same", "D", "Gamma emission only releases energy, not protons or neutrons.", "Radioactivity and nuclear chemistry", "easy"),
    (297, "If a 80 g sample has a half-life of 2 hours, how much remains after 6 hours?", "40 g", "20 g", "10 g", "5 g", "C", "6 hours = 3 half-lives: 80 -> 40 -> 20 -> 10 g.", "Radioactivity and nuclear chemistry", "easy"),
    (298, "Nuclear power plants generate electricity using:", "Nuclear fusion", "Controlled nuclear fission", "Alpha decay only", "Chemical combustion", "B", "Nuclear reactors use controlled fission of U-235 or Pu-239.", "Radioactivity and nuclear chemistry", "easy"),
    (299, "Which material is best for shielding against gamma rays?", "Paper", "Aluminum foil", "Thick lead or concrete", "Plastic wrap", "C", "Dense materials like thick lead or concrete are needed to attenuate gamma rays.", "Radioactivity and nuclear chemistry", "easy"),
    (300, "Cobalt-60 is commonly used in medicine for:", "Blood sugar testing", "Cancer radiation therapy", "X-ray film development", "Measuring blood pressure", "B", "Cobalt-60 emits gamma rays used in radiotherapy to destroy cancer cells.", "Radioactivity and nuclear chemistry", "easy")
]

csv_path = r"c:\Users\obado\OneDrive\Desktop\NURSING PREP\chm101_general_chemistry_100_extra.csv"

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f, quoting=csv.QUOTE_ALL)
    writer.writerow([
        "item_no",
        "question_text",
        "option_a",
        "option_b",
        "option_c",
        "option_d",
        "correct_answer",
        "explanation",
        "topic",
        "difficulty"
    ])
    for q in questions:
        writer.writerow(q)

print(f"Successfully generated {len(questions)} extra questions at: {csv_path}")
