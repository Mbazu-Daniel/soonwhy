function getDependencyType(span: ParsedSpan): string {
  if (span.kind !== 3) return '';

  if (
    span.attributes['db.system.name'] ||
    span.attributes['db.system'] ||
    span.attributes.db_system
  ) {
    const system = String(span.attributes['db.system.name'] ?? span.attributes['db.system'] ?? span.attributes.db_system ?? '').toLowerCase();
    if (system === 'redis' || system === 'memcached') return system;
    return 'database';
  }

  if (
    span.attributes['rpc.system'] ||
    span.attributes['rpc.service.name'] ||
    span.attributes['rpc.service']
  ) {
    return 'rpc';
  }

  if (
    span.attributes['http.request.method'] ||
    span.attributes['http.method'] ||
    span.attributes['url.full'] ||
    span.attributes['http.url']
  ) {
    return 'http';
  }

  return 'service';
}

function getDependencyName(span: ParsedSpan): string {
  if (span.kind !== 3) return '';

  const dependencyType = getDependencyType(span);
  if (dependencyType === 'redis' || dependencyType === 'memcached') {
    return String(
      span.attributes['server.address'] ??
        span.attributes['network.peer.address'] ??
        span.attributes['db.system.name'] ??
        span.resource.serviceName ??
        span.name ??
        '',
    );
  }

  return String(
    span.attributes['db.system.name'] ??
      span.attributes['db.system'] ??
      span.attributes.db_system ??
      span.attributes['server.address'] ??
      span.attributes['network.peer.address'] ??
      span.resource.serviceName ??
      span.name ??
      '',
  );
}
