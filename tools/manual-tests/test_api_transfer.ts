async function testApiCall() {
  try {
    const payload = {
      from_warehouse_id: 1,
      to_warehouse_id: 2,
      date: '2026-09-12',
      type: 'inter_branch',
      priority: 'normal',
      department: '',
      purpose: '',
      notes: 'تجربة تحويل معتمد',
      driver_name: 'jhjkhkj',
      vehicle_no: '598',
      shipping_cost: 50,
      items: [{
        ingredient_id: 1,
        requested_qty: 250,
        approved_qty: 250,
        unit_cost: 88.125,
        name: 'طماطم',
        code: '1',
        unit: 'كجم'
      }],
      status: 'approved',
      auto_post: true
    };

    const res = await fetch('http://localhost:3000/api/enterprise/warehouse-transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer preview-bypass-token'
      },
      body: JSON.stringify(payload)
    });

    console.log('HTTP Status:', res.status);
    const data = await res.json();
    console.log('Response data:', data);
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  } finally {
    process.exit(0);
  }
}

testApiCall();
