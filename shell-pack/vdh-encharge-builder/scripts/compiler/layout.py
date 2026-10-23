"""layout.py -- vdh-encharge-builder's compiler (v1.10, P20: moved out of compile.py as it stood in v1.09, the code
unchanged): canvas positions: 300 px between rows, 450 below a Send email step, lanes for branches.

compile.py is the command line and keeps every command, option, message and exit code."""

ROW_GAP = 300    # px from a step to the one below it on the canvas; 200 until v0.3 (Joe, 2026-09-25: a little more space)
SEND_GAP = 450   # below a Send email step, which the canvas draws about 300 px tall with the email and its counters, so the


def layout(nodes, edges, trigger_key, ops=None):
    """Each step below the lowest step that leads to it: ROW_GAP below it, or SEND_GAP below a Send email step (the
    longest path from the trigger, in pixels). The main path in lane 0, each No or On bounced branch in a new lane to
    the right. Two steps in one lane are never closer than the gap below the upper one; a step that would be moves
    right, a lane at a time, until it fits. ops = {key: operationKey}. Without a Send email step, rows fall every
    ROW_GAP, as in v0.4."""
    ops = ops or {}
    order, seen = [], set()
    preds = {k: [] for k in nodes}
    for a, b, _ in edges:
        preds[b].append(a)

    def visit(k):
        if k in seen:
            return
        seen.add(k)
        for a in preds[k]:
            visit(a)
        order.append(k)
    for k in nodes:
        visit(k)

    def gap(k):
        return SEND_GAP if ops.get(k) == '/send' else ROW_GAP
    y = {}
    for k in order:
        y[k] = 0 if not preds[k] else max(y[a] + gap(a) for a in preds[k])
    lane, in_lane = {trigger_key: 0}, {0: [trigger_key]}

    def clash(ln, k):
        for o in in_lane.get(ln, []):
            upper, lower = (o, k) if y[o] <= y[k] else (k, o)
            if y[lower] - y[upper] < gap(upper):
                return True
        return False
    next_lane = [1]
    queue = [trigger_key]
    while queue:
        k = queue.pop(0)
        for a, b, kind in edges:
            if a != k or b in lane:
                continue
            want = lane[k] if kind in ('next', 'yes') else next_lane[0]
            if kind not in ('next', 'yes'):   # a No branch or an On bounced branch opens a lane to the right
                next_lane[0] += 1
            while clash(want, b):
                want += 1
            lane[b] = want
            in_lane.setdefault(want, []).append(b)
            queue.append(b)
    for k in nodes:
        lane.setdefault(k, next_lane[0])
    return {k: {'x': 25 + 350 * lane[k], 'y': -50 + y[k]} for k in nodes}
