import circuit_parser as cp

netlist = open('test_data/InverterFB_ltspice3_.cir', encoding='utf-8', errors='ignore').read()
log = open('test_data/InverterFB_ltspice3_.log', encoding='utf-8', errors='ignore').read()

circ = cp.Circuit.from_ltspice_netlist(netlist, log)

print('\n\n===== FINAL RESULT =====')
print('Nodes:', list(circ.multigraph.nodes()))
print('\nEdges with components:')
for u, v, key, data in circ.multigraph.edges(keys=True, data=True):
    comp = data['component']
    print(f'{u} -- {v} [{key}]: pos={comp.pos_node}, neg={comp.neg_node}', end='')
    if hasattr(comp, 'pos_input_node'):
        print(f', ctrl_pos={comp.pos_input_node}, ctrl_neg={comp.neg_input_node}', end='')
    print()

print('\n===== CHECK: Any reference to Vp or Vn? =====')
has_vp_vn = False
for u, v, key, data in circ.multigraph.edges(keys=True, data=True):
    comp = data['component']
    if hasattr(comp, 'pos_input_node'):
        if 'Vp' in [comp.pos_input_node, comp.neg_input_node] or 'Vn' in [comp.pos_input_node, comp.neg_input_node]:
            print(f'ERROR: {key} still references Vp or Vn: ctrl_pos={comp.pos_input_node}, ctrl_neg={comp.neg_input_node}')
            has_vp_vn = True

if not has_vp_vn:
    print('SUCCESS: No components reference Vp or Vn!')
