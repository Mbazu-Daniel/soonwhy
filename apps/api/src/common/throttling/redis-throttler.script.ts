export const THROTTLE_SCRIPT = `
local blocked = redis.call('GET', KEYS[2])
if blocked then
  local blockTtl = redis.call('PTTL', KEYS[2])
  return { tonumber(blocked), blockTtl, 1, blockTtl }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  local blockMs = tonumber(ARGV[3])
  if blockMs > 0 then
    redis.call('SET', KEYS[2], hits, 'PX', blockMs)
    redis.call('DEL', KEYS[1])
    return { hits, ttl, 1, blockMs }
  end
  redis.call('DECR', KEYS[1])
  return { hits, ttl, 1, ttl }
end
return { hits, ttl, 0, 0 }
`;
