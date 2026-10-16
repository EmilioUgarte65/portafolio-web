import subprocess
import os

# Let's test interaction using edge with a small HTML test runner or headless check
test_script = """
(() => {
  // 1. Check all elements exist
  const searchInput = document.getElementById('catalogSearch');
  const pills = document.querySelectorAll('.cat-pill');
  const viewGrid = document.getElementById('btnViewGrid');
  const viewIndex = document.getElementById('btnViewIndex');
  const grid = document.getElementById('catalogGrid');
  const indexWrap = document.getElementById('catalogIndexWrap');
  const modal = document.getElementById('catalogModal');
  const countEl = document.getElementById('visibleCount');

  console.log('INIT CHECK:', {
    hasSearch: !!searchInput,
    pillCount: pills.length,
    hasViews: !!viewGrid && !!viewIndex,
    hasGrid: !!grid,
    hasIndex: !!indexWrap,
    hasModal: !!modal,
    initialCount: countEl ? countEl.textContent : null
  });

  // 2. Test filter click: IA & ML
  const iaPill = document.querySelector('.cat-pill[data-filter="ia"]');
  if (iaPill) {
    iaPill.click();
    console.log('AFTER IA FILTER:', countEl.textContent);
  }

  // 3. Test filter click: Demos
  const demoPill = document.querySelector('.cat-pill[data-filter="demo"]');
  if (demoPill) {
    demoPill.click();
    console.log('AFTER DEMO FILTER:', countEl.textContent);
  }

  // 4. Test view switch to Index Table
  if (viewIndex) {
    viewIndex.click();
    console.log('VIEW SWITCH TO INDEX:', {
      gridDisplay: grid.style.display,
      indexDisplay: indexWrap.style.display
    });
  }

  // 5. Test modal open
  openProjectModal('dino-ai');
  console.log('MODAL OPEN TEST:', {
    isOpen: modal.classList.contains('open'),
    title: document.getElementById('modalProjTitle').textContent
  });
})();
"""

# Let's run a test by injecting this into page or checking via Node or Python
with open(r'C:\Users\carlo\Documents\portafolio-web\tools\test_runner.js', 'w', encoding='utf-8') as f:
    f.write(test_script)

print("Created test_runner.js")
